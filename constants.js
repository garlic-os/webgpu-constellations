import { canvas } from "./canvas.js";

export const FRAME_WIDTH_PIX = canvas.width;
export const FRAME_HEIGHT_PIX = canvas.height;
export const ASPECT_RATIO_CORRECTION = FRAME_WIDTH_PIX / FRAME_HEIGHT_PIX;

export const STAR_COUNT = 115;

export const STAR_RADIUS_PIX = 20;
export const STAR_WIDTH_CLIP = STAR_RADIUS_PIX / canvas.width / 2;
export const STAR_HEIGHT_CLIP = STAR_RADIUS_PIX / canvas.height / 2;

export const LINE_THICKNESS = 3;
export const LINE_THRESHOLD = 250.0;  // How close stars must be before they connect.

// const SPEED_MULTIPLIER = 2.5;

export const STAR_COLOR = [0.898, 0.89, 0.8745];
export const BACKGROUND_COLOR = [0.0627, 0.0706, 0.0706];

export const WORKGROUP_SIZE = 8;
