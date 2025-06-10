"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlfredApp = void 0;
const react_1 = __importDefault(require("react"));
const useAlfredContext_1 = require("./hooks/useAlfredContext");
const AlfredRoutes_1 = require("./AlfredRoutes");
require("./styles/alfred-enhanced.css");
const AlfredApp = () => {
    return (react_1.default.createElement(useAlfredContext_1.AlfredProvider, null,
        react_1.default.createElement(AlfredRoutes_1.AlfredRoutes, null)));
};
exports.AlfredApp = AlfredApp;
