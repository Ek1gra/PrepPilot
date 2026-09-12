import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { isSafeUrl } from './security';

export interface CrawlResult {
  homePageText: string;
  hiringPageText: string;
  discussionText: string;
  pagesUsed: string[];
  unreachable: boolean;
  errorMessage?: string;
}

const LINK_KEYWORDS = ['careers', 'jobs', 'hiring', 'work-with-us', 'culture', 'handbook', 'join-us', 'team', 'about'];
const MAX_BYTES = 2 * 1024 * 1024;

export class CompanyScraper {
  private timeout = Number(process.env.SCRAPER_TIMEOUT_MS || 8000);
  private allowLocal = process.env.NODE_ENV !== 'production';

  async crawlCompany(companyUrl: string): Promise<CrawlResult> {
    if (!isSafeUrl(companyUrl, this.allowLocal)) {
      return { homePageText: '', hiringPageText: '', discussionText: '', pagesUsed: [], unreachable: true, errorMessage: 'Invalid or unsafe URL' };
    }

    const base = new URL(companyUrl);
    const pagesUsed: string[] = [];
    const robots = await this.getRobots(base);

    if (!this.allowedByRobots(companyUrl, robots)) {
      return { homePageText: '', hiringPageText: '', discussionText: '', pagesUsed: [], unreachable: true, errorMessage: 'Blocked by robots.txt' };
    }

    let homeHtml: string;
    try {
      homeHtml = await this.fetchText(companyUrl, robots);
      pagesUsed.push(companyUrl);
    } catch (error: any) {
      return {
        homePageText: '',
        hiringPageText: '',
        discussionText: '',
        pagesUsed: [],
        unreachable: true,
        errorMessage: error?.message || 'Failed to reach company URL',
      };
    }

    const $ = cheerio.load(homeHtml);
    const homePageText = this.extractCleanText($).slice(0, 5000);
    const candidates = this.rankLinks($, base, companyUrl);
    const fetched: Array<{ url: string; text: string }> = [];

    for (const candidate of candidates.slice(0, 5)) {
      if (!this.allowedByRobots(candidate.url, robots)) continue;
      try {
        const html = await this.fetchText(candidate.url, robots);
        const text = this.extractCleanText(cheerio.load(html)).slice(0, 5000);
        if (text) {
          pagesUsed.push(candidate.url);
          fetched.push({ url: candidate.url, text });
        }
      } catch {
        continue;
      }
    }

    const hiring = fetched
      .sort((a, b) => this.hiringScore(b.url) - this.hiringScore(a.url))
      .slice(0, 3)
      .map((page) => page.text)
      .join('\n\n')
      .slice(0, 8000);

    const discussion = await this.searchPublicDiscussion(base.hostname).catch(() => '');

    return {
      homePageText,
      hiringPageText: hiring,
      discussionText: discussion.slice(0, 6000),
      pagesUsed,
      unreachable: false,
    };
  }

  private async fetchText(url: string, robots: string): Promise<string> {
    if (!isSafeUrl(url, this.allowLocal) || !this.allowedByRobots(url, robots)) throw new Error('URL is not fetchable');
    const config: AxiosRequestConfig = {
      timeout: this.timeout,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      responseType: 'text',
      maxRedirects: 3,
      headers: { 'User-Agent': 'PrepPilot/1.0 (+https://trao.ai)' },
    };
    const response = await axios.get(url, config);
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) throw new Error('Unsupported content type');
    return String(response.data || '');
  }

  private rankLinks($: cheerio.CheerioAPI, base: URL, source: string): Array<{ url: string; score: number }> {
    const candidates = new Map<string, number>();
    $('a[href]').each((_, element) => {
      try {
        const resolved = new URL($(element).attr('href') || '', base);
        if (resolved.hostname !== base.hostname || resolved.toString() === source) return;
        if (!isSafeUrl(resolved.toString(), this.allowLocal)) return;
        const text = $(element).text().toLowerCase();
        const combined = `${resolved.pathname} ${resolved.search} ${text}`;
        const score = LINK_KEYWORDS.reduce((total, keyword) => total + (combined.includes(keyword) ? 5 : 0), 0);
        if (score > 0) candidates.set(resolved.toString(), Math.max(score, candidates.get(resolved.toString()) || 0));
      } catch {
        return;
      }
    });
    return [...candidates.entries()].map(([url, score]) => ({ url, score })).sort((a, b) => b.score - a.score);
  }

  private hiringScore(url: string): number {
    const value = url.toLowerCase();
    return LINK_KEYWORDS.reduce((score, keyword) => score + (value.includes(keyword) ? 1 : 0), 0);
  }

  private extractCleanText($: cheerio.CheerioAPI): string {
    $('script, style, noscript, svg, nav, footer, header, form').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  }

  private async getRobots(base: URL): Promise<string> {
    try {
      const robotsUrl = new URL('/robots.txt', base.origin).toString();
      const response = await axios.get(robotsUrl, { timeout: this.timeout, responseType: 'text' });
      return String(response.data || '');
    } catch {
      return '';
    }
  }

  private allowedByRobots(url: string, robots: string): boolean {
    if (!robots) return true;
    const parsed = new URL(url);
    const rules = robots.split(/\r?\n/).map((line) => line.trim());
    let applies = false;
    for (const rule of rules) {
      const [key, value = ''] = rule.split(':', 2).map((part) => part.trim());
      if (key.toLowerCase() === 'user-agent') applies = value === '*' || value.toLowerCase().includes('preppilot');
      if (applies && key.toLowerCase() === 'disallow' && value && parsed.pathname.startsWith(value)) return false;
    }
    return true;
  }

  private async searchPublicDiscussion(hostname: string): Promise<string> {
    const query = encodeURIComponent(`"${hostname}" interview process OR hiring OR interview reddit`);
    const url = `https://www.google.com/search?q=${query}&num=5`;
    const response = await axios.get(url, {
      timeout: this.timeout,
      responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0 PrepPilot/1.0' },
      maxContentLength: MAX_BYTES,
    });
    const $ = cheerio.load(String(response.data || ''));
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 6000);
  }
}
