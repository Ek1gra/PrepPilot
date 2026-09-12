import mongoose, { Document, Schema } from 'mongoose';
import { PrepKit } from '../types/kit';

export interface ItemStateMap {
  [itemId: string]: {
    isEdited?: boolean;
    isPinned?: boolean;
    isCustom?: boolean;
  };
}

export interface IKitDocument extends Document {
  userId: string;
  rawInput: { jd: string; companyUrl: string; days: number };
  kit: PrepKit;
  itemStates: ItemStateMap;
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<IKitDocument>(
  {
    userId: { type: String, required: true, index: true },
    rawInput: {
      jd: { type: String, required: true },
      companyUrl: { type: String, required: true },
      days: { type: Number, required: true, min: 1, max: 60 },
    },
    kit: { type: Schema.Types.Mixed, required: true },
    itemStates: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

KitSchema.index({ userId: 1, createdAt: -1 });

export const KitModel = mongoose.model<IKitDocument>('Kit', KitSchema);
