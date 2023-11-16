"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const HookCalls_1 = __importDefault(require("./HookCalls"));
const macropacks = [
    new HookCalls_1.default({
        path: (0, path_1.resolve)(process.cwd(), "src", "code", "useCloudflareData.ts"),
        exportIdentifier: "default",
        allowedArgTypes: ["StringLiteral"],
    }, "useCloudflareData"),
];
exports.default = macropacks;
