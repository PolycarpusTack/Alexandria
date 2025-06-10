"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = void 0;
exports.cn = cn;
exports.formatDate = formatDate;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
function formatDate(input) {
    const date = new Date(input);
    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.wait = wait;
