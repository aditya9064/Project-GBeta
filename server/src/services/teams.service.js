"use strict";
/* ═══════════════════════════════════════════════════════════
   Microsoft Teams Integration Service
   
   Uses MSAL + Microsoft Graph API to:
   - Authenticate via OAuth2
   - Fetch chat and channel messages
   - Send replies
   - List teams and channels
   ═══════════════════════════════════════════════════════════ */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsService = void 0;
var msal_node_1 = require("@azure/msal-node");
var microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
var config_js_1 = require("../config.js");
/* ─── State ────────────────────────────────────────────── */
var msalClient = null;
var graphClient = null;
var accessToken = null;
var connectionState = {
    channel: 'teams',
    status: 'disconnected',
};
/* ─── Helpers ──────────────────────────────────────────── */
function generateColor(name) {
    var colors = ['#7C3AED', '#3B82F6', '#e07a3a', '#1a1a2e', '#d46b2c', '#EC4899', '#10B981', '#6264A7'];
    var hash = 0;
    for (var i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}
function getInitials(name) {
    return name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
}
function getRelativeTime(date) {
    var now = new Date();
    var diff = now.getTime() - date.getTime();
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1)
        return 'just now';
    if (minutes < 60)
        return "".concat(minutes, " min ago");
    var hours = Math.floor(minutes / 60);
    if (hours < 24)
        return "".concat(hours, " hr").concat(hours > 1 ? 's' : '', " ago");
    var days = Math.floor(hours / 24);
    return "".concat(days, " day").concat(days > 1 ? 's' : '', " ago");
}
function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
}
/** Initialize MSAL client */
function ensureMsalClient() {
    if (!msalClient) {
        msalClient = new msal_node_1.ConfidentialClientApplication({
            auth: {
                clientId: config_js_1.config.microsoft.clientId,
                clientSecret: config_js_1.config.microsoft.clientSecret,
                authority: "https://login.microsoftonline.com/".concat(config_js_1.config.microsoft.tenantId),
            },
        });
    }
    return msalClient;
}
/** Create a Graph client with the current access token */
function createGraphClient(token) {
    return microsoft_graph_client_1.Client.init({
        authProvider: function (done) {
            done(null, token);
        },
    });
}
/* ─── Public API ───────────────────────────────────────── */
exports.TeamsService = {
    /** Generate the OAuth2 authorization URL */
    getAuthUrl: function () {
        var msal = ensureMsalClient();
        var authUrl = "https://login.microsoftonline.com/".concat(config_js_1.config.microsoft.tenantId, "/oauth2/v2.0/authorize?") +
            "client_id=".concat(config_js_1.config.microsoft.clientId) +
            "&response_type=code" +
            "&redirect_uri=".concat(encodeURIComponent(config_js_1.config.microsoft.redirectUri)) +
            "&scope=".concat(encodeURIComponent(config_js_1.config.microsoft.scopes.join(' '))) +
            "&response_mode=query";
        return authUrl;
    },
    /** Exchange authorization code for tokens */
    handleCallback: function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var msal, tokenResponse, me, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        msal = ensureMsalClient();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, msal.acquireTokenByCode({
                                code: code,
                                scopes: __spreadArray([], config_js_1.config.microsoft.scopes, true),
                                redirectUri: config_js_1.config.microsoft.redirectUri,
                            })];
                    case 2:
                        tokenResponse = _a.sent();
                        accessToken = tokenResponse.accessToken;
                        graphClient = createGraphClient(accessToken);
                        return [4 /*yield*/, graphClient.api('/me').get()];
                    case 3:
                        me = _a.sent();
                        connectionState = {
                            channel: 'teams',
                            status: 'connected',
                            accountEmail: me.mail || me.userPrincipalName,
                            accountName: me.displayName,
                            connectedAt: new Date(),
                            lastSyncAt: new Date(),
                            scopes: __spreadArray([], config_js_1.config.microsoft.scopes, true),
                        };
                        return [2 /*return*/, connectionState];
                    case 4:
                        err_1 = _a.sent();
                        connectionState = {
                            channel: 'teams',
                            status: 'error',
                            error: err_1 instanceof Error ? err_1.message : 'Authentication failed',
                        };
                        throw err_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    },
    /** Set access token directly */
    setToken: function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var me;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        accessToken = token;
                        graphClient = createGraphClient(token);
                        return [4 /*yield*/, graphClient.api('/me').get()];
                    case 1:
                        me = _a.sent();
                        connectionState = {
                            channel: 'teams',
                            status: 'connected',
                            accountEmail: me.mail || me.userPrincipalName,
                            accountName: me.displayName,
                            connectedAt: new Date(),
                            lastSyncAt: new Date(),
                        };
                        return [2 /*return*/];
                }
            });
        });
    },
    /** Fetch recent Teams messages (from chats and channels) */
    fetchMessages: function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var messages, chatsResponse, _i, _a, chat, messagesResponse, _b, _c, msg, senderName, body, timestamp, teamsChannel, err_2, teamsResponse, _d, _e, team, channelsResponse, _f, _g, channel, channelMsgs, _h, _j, msg, senderName, body, timestamp, err_3, err_4, err_5;
            var _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_v) {
                switch (_v.label) {
                    case 0:
                        if (!graphClient)
                            throw new Error('Teams not connected');
                        messages = [];
                        _v.label = 1;
                    case 1:
                        _v.trys.push([1, 21, , 22]);
                        return [4 /*yield*/, graphClient
                                .api('/me/chats')
                                .top(20)
                                .orderby('lastMessagePreview/createdDateTime desc')
                                .get()];
                    case 2:
                        chatsResponse = _v.sent();
                        _i = 0, _a = (chatsResponse.value || []).slice(0, Math.ceil(limit / 2));
                        _v.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        chat = _a[_i];
                        _v.label = 4;
                    case 4:
                        _v.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, graphClient
                                .api("/me/chats/".concat(chat.id, "/messages"))
                                .top(5)
                                .orderby('createdDateTime desc')
                                .get()];
                    case 5:
                        messagesResponse = _v.sent();
                        for (_b = 0, _c = messagesResponse.value || []; _b < _c.length; _b++) {
                            msg = _c[_b];
                            if (!((_k = msg.body) === null || _k === void 0 ? void 0 : _k.content))
                                continue;
                            if (msg.messageType !== 'message')
                                continue;
                            senderName = ((_m = (_l = msg.from) === null || _l === void 0 ? void 0 : _l.user) === null || _m === void 0 ? void 0 : _m.displayName) || 'Unknown';
                            body = msg.body.contentType === 'html'
                                ? stripHtml(msg.body.content)
                                : msg.body.content;
                            timestamp = new Date(msg.createdDateTime);
                            teamsChannel = chat.topic || 'Direct Message';
                            if (chat.chatType === 'group') {
                                teamsChannel = chat.topic || 'Group Chat';
                            }
                            messages.push({
                                id: "teams-".concat(chat.id, "-").concat(msg.id),
                                externalId: msg.id,
                                channel: 'teams',
                                from: senderName,
                                fromEmail: (_p = (_o = msg.from) === null || _o === void 0 ? void 0 : _o.user) === null || _p === void 0 ? void 0 : _p.email,
                                fromInitial: getInitials(senderName),
                                fromColor: generateColor(senderName),
                                teamsChannel: teamsChannel,
                                preview: body.slice(0, 200),
                                fullMessage: body,
                                receivedAt: timestamp,
                                receivedTime: timestamp.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                }),
                                relativeTime: getRelativeTime(timestamp),
                                priority: body.toLowerCase().includes('urgent') ? 'high' : 'medium',
                                status: 'pending',
                                starred: msg.importance === 'high',
                                metadata: {
                                    chatId: chat.id,
                                    messageId: msg.id,
                                    chatType: chat.chatType,
                                },
                            });
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        err_2 = _v.sent();
                        console.error("Error fetching messages from chat ".concat(chat.id, ":"), err_2);
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        _v.trys.push([8, 19, , 20]);
                        return [4 /*yield*/, graphClient.api('/me/joinedTeams').get()];
                    case 9:
                        teamsResponse = _v.sent();
                        _d = 0, _e = (teamsResponse.value || []).slice(0, 5);
                        _v.label = 10;
                    case 10:
                        if (!(_d < _e.length)) return [3 /*break*/, 18];
                        team = _e[_d];
                        return [4 /*yield*/, graphClient
                                .api("/teams/".concat(team.id, "/channels"))
                                .get()];
                    case 11:
                        channelsResponse = _v.sent();
                        _f = 0, _g = (channelsResponse.value || []).slice(0, 3);
                        _v.label = 12;
                    case 12:
                        if (!(_f < _g.length)) return [3 /*break*/, 17];
                        channel = _g[_f];
                        _v.label = 13;
                    case 13:
                        _v.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, graphClient
                                .api("/teams/".concat(team.id, "/channels/").concat(channel.id, "/messages"))
                                .top(5)
                                .orderby('createdDateTime desc')
                                .get()];
                    case 14:
                        channelMsgs = _v.sent();
                        for (_h = 0, _j = channelMsgs.value || []; _h < _j.length; _h++) {
                            msg = _j[_h];
                            if (!((_q = msg.body) === null || _q === void 0 ? void 0 : _q.content))
                                continue;
                            if (msg.messageType !== 'message')
                                continue;
                            senderName = ((_s = (_r = msg.from) === null || _r === void 0 ? void 0 : _r.user) === null || _s === void 0 ? void 0 : _s.displayName) || 'Unknown';
                            body = msg.body.contentType === 'html'
                                ? stripHtml(msg.body.content)
                                : msg.body.content;
                            timestamp = new Date(msg.createdDateTime);
                            messages.push({
                                id: "teams-ch-".concat(channel.id, "-").concat(msg.id),
                                externalId: msg.id,
                                channel: 'teams',
                                from: senderName,
                                fromEmail: (_u = (_t = msg.from) === null || _t === void 0 ? void 0 : _t.user) === null || _u === void 0 ? void 0 : _u.email,
                                fromInitial: getInitials(senderName),
                                fromColor: generateColor(senderName),
                                teamsChannel: "".concat(team.displayName, " \u00B7 ").concat(channel.displayName),
                                preview: body.slice(0, 200),
                                fullMessage: body,
                                receivedAt: timestamp,
                                receivedTime: timestamp.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                }),
                                relativeTime: getRelativeTime(timestamp),
                                priority: msg.importance === 'high' ? 'high' : 'medium',
                                status: 'pending',
                                starred: msg.importance === 'high',
                                metadata: {
                                    teamId: team.id,
                                    channelId: channel.id,
                                    messageId: msg.id,
                                },
                            });
                        }
                        return [3 /*break*/, 16];
                    case 15:
                        err_3 = _v.sent();
                        console.error("Error fetching channel messages:", err_3);
                        return [3 /*break*/, 16];
                    case 16:
                        _f++;
                        return [3 /*break*/, 12];
                    case 17:
                        _d++;
                        return [3 /*break*/, 10];
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        err_4 = _v.sent();
                        console.error('Error fetching teams:', err_4);
                        return [3 /*break*/, 20];
                    case 20:
                        // Sort by time (newest first) and limit
                        messages.sort(function (a, b) { return b.receivedAt.getTime() - a.receivedAt.getTime(); });
                        connectionState.lastSyncAt = new Date();
                        connectionState.messageCount = messages.length;
                        return [2 /*return*/, messages.slice(0, limit)];
                    case 21:
                        err_5 = _v.sent();
                        console.error('Error fetching Teams messages:', err_5);
                        throw err_5;
                    case 22: return [2 /*return*/];
                }
            });
        });
    },
    /** Send a reply to a Teams chat message */
    sendReply: function (chatId, text) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!graphClient)
                            throw new Error('Teams not connected');
                        return [4 /*yield*/, graphClient.api("/me/chats/".concat(chatId, "/messages")).post({
                                body: {
                                    content: text,
                                    contentType: 'text',
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    },
    /** Send a reply to a Teams channel message */
    sendChannelReply: function (teamId, channelId, messageId, text) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!graphClient)
                            throw new Error('Teams not connected');
                        return [4 /*yield*/, graphClient
                                .api("/teams/".concat(teamId, "/channels/").concat(channelId, "/messages/").concat(messageId, "/replies"))
                                .post({
                                body: {
                                    content: text,
                                    contentType: 'text',
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    },
    /** Get current connection status */
    getConnection: function () {
        return connectionState;
    },
    /** Disconnect */
    disconnect: function () {
        graphClient = null;
        accessToken = null;
        connectionState = {
            channel: 'teams',
            status: 'disconnected',
        };
    },
};
