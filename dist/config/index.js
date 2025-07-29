"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOADS_DIR = void 0;
const path_1 = __importDefault(require("path"));
exports.UPLOADS_DIR = path_1.default.resolve(__dirname, "../../../uploads");
