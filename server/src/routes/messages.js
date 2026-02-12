"use strict";
/* ═══════════════════════════════════════════════════════════
   Messages API Routes
   
   GET  /api/messages          — Fetch all messages (unified inbox)
   GET  /api/messages/:id      — Get single message detail
   POST /api/messages/:id/draft — Generate AI draft for a message
   POST /api/messages/:id/send  — Send the approved draft
   PUT  /api/messages/:id      — Update message (star, status, etc.)
   POST /api/messages/sync     — Sync from all connected channels
   POST /api/messages/draft-all — Auto-draft all pending messages
   ═══════════════════════════════════════════════════════════ */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.messageStore = exports.messagesRouter = void 0;
var express_1 = require("express");
var gmail_service_js_1 = require("../services/gmail.service.js");
var slack_service_js_1 = require("../services/slack.service.js");
var teams_service_js_1 = require("../services/teams.service.js");
var ai_engine_js_1 = require("../services/ai-engine.js");
var router = (0, express_1.Router)();
exports.messagesRouter = router;
/* ─── In-memory message store ──────────────────────────── */
var messageStore = [];
exports.messageStore = messageStore;
var lastSyncTime = null;
/* ─── GET /api/messages ────────────────────────────────── */
router.get('/', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, channel_1, status_1, priority_1, search, limit, filtered, q_1, channels, response;
    return __generator(this, function (_b) {
        try {
            _a = req.query, channel_1 = _a.channel, status_1 = _a.status, priority_1 = _a.priority, search = _a.search, limit = _a.limit;
            filtered = __spreadArray([], messageStore, true);
            // Apply filters
            if (channel_1 && channel_1 !== 'all') {
                filtered = filtered.filter(function (m) { return m.channel === channel_1; });
            }
            if (status_1 && status_1 !== 'all') {
                filtered = filtered.filter(function (m) { return m.status === status_1; });
            }
            if (priority_1 && priority_1 !== 'all') {
                filtered = filtered.filter(function (m) { return m.priority === priority_1; });
            }
            if (search) {
                q_1 = search.toLowerCase();
                filtered = filtered.filter(function (m) {
                    return m.from.toLowerCase().includes(q_1) ||
                        (m.subject || '').toLowerCase().includes(q_1) ||
                        m.preview.toLowerCase().includes(q_1);
                });
            }
            // Sort by received time (newest first)
            filtered.sort(function (a, b) { return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(); });
            if (limit) {
                filtered = filtered.slice(0, parseInt(limit, 10));
            }
            channels = {
                email: messageStore.filter(function (m) { return m.channel === 'email'; }).length,
                slack: messageStore.filter(function (m) { return m.channel === 'slack'; }).length,
                teams: messageStore.filter(function (m) { return m.channel === 'teams'; }).length,
            };
            response = {
                success: true,
                data: {
                    messages: filtered,
                    total: filtered.length,
                    channels: channels,
                },
            };
            res.json(response);
        }
        catch (err) {
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : 'Failed to fetch messages',
            });
        }
        return [2 /*return*/];
    });
}); });
/* ─── GET /api/messages/:id ────────────────────────────── */
router.get('/:id', function (req, res) {
    var message = messageStore.find(function (m) { return m.id === req.params.id; });
    if (!message) {
        res.status(404).json({ success: false, error: 'Message not found' });
        return;
    }
    res.json({ success: true, data: message });
});
/* ─── POST /api/messages/:id/draft ─────────────────────── */
router.post('/:id/draft', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var message, feedback, result, _a, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                message = messageStore.find(function (m) { return m.id === req.params.id; });
                if (!message) {
                    res.status(404).json({ success: false, error: 'Message not found' });
                    return [2 /*return*/];
                }
                feedback = (req.body || {}).feedback;
                if (!feedback) return [3 /*break*/, 2];
                return [4 /*yield*/, ai_engine_js_1.AIEngine.regenerateWithFeedback(message, feedback)];
            case 1:
                _a = _b.sent();
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, ai_engine_js_1.AIEngine.generateResponse(message)];
            case 3:
                _a = _b.sent();
                _b.label = 4;
            case 4:
                result = _a;
                // Update the message in store
                message.aiDraft = result.draft;
                message.aiConfidence = result.confidence;
                message.status = 'ai_drafted';
                res.json({
                    success: true,
                    data: {
                        messageId: message.id,
                        draft: result.draft,
                        confidence: result.confidence,
                        analysis: result.analysis,
                        reasoning: result.reasoning,
                    },
                });
                return [3 /*break*/, 6];
            case 5:
                err_1 = _b.sent();
                res.status(500).json({
                    success: false,
                    error: err_1 instanceof Error ? err_1.message : 'Failed to generate draft',
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
/* ─── POST /api/messages/:id/send ──────────────────────── */
router.post('/:id/send', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var message, draftText, sent, _a, meta, meta, err_2;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 11, , 12]);
                message = messageStore.find(function (m) { return m.id === req.params.id; });
                if (!message) {
                    res.status(404).json({ success: false, error: 'Message not found' });
                    return [2 /*return*/];
                }
                draftText = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.draft) || message.aiDraft;
                if (!draftText) {
                    res.status(400).json({ success: false, error: 'No draft to send' });
                    return [2 /*return*/];
                }
                sent = false;
                _a = message.channel;
                switch (_a) {
                    case 'email': return [3 /*break*/, 1];
                    case 'slack': return [3 /*break*/, 3];
                    case 'teams': return [3 /*break*/, 5];
                }
                return [3 /*break*/, 10];
            case 1: return [4 /*yield*/, gmail_service_js_1.GmailService.sendReply(message.externalId, draftText)];
            case 2:
                sent = _c.sent();
                return [3 /*break*/, 10];
            case 3:
                meta = message.metadata;
                return [4 /*yield*/, slack_service_js_1.SlackService.sendReply(meta === null || meta === void 0 ? void 0 : meta.channelId, draftText, (meta === null || meta === void 0 ? void 0 : meta.threadTs) || (meta === null || meta === void 0 ? void 0 : meta.ts))];
            case 4:
                sent = _c.sent();
                return [3 /*break*/, 10];
            case 5:
                meta = message.metadata;
                if (!((meta === null || meta === void 0 ? void 0 : meta.teamId) && (meta === null || meta === void 0 ? void 0 : meta.channelId))) return [3 /*break*/, 7];
                return [4 /*yield*/, teams_service_js_1.TeamsService.sendChannelReply(meta.teamId, meta.channelId, meta.messageId, draftText)];
            case 6:
                sent = _c.sent();
                return [3 /*break*/, 9];
            case 7:
                if (!(meta === null || meta === void 0 ? void 0 : meta.chatId)) return [3 /*break*/, 9];
                return [4 /*yield*/, teams_service_js_1.TeamsService.sendReply(meta.chatId, draftText)];
            case 8:
                sent = _c.sent();
                _c.label = 9;
            case 9: return [3 /*break*/, 10];
            case 10:
                if (sent) {
                    message.status = 'sent';
                }
                res.json({
                    success: sent,
                    data: { messageId: message.id, status: message.status },
                    message: sent ? 'Response sent successfully' : 'Failed to send',
                });
                return [3 /*break*/, 12];
            case 11:
                err_2 = _c.sent();
                res.status(500).json({
                    success: false,
                    error: err_2 instanceof Error ? err_2.message : 'Failed to send message',
                });
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
/* ─── PUT /api/messages/:id ────────────────────────────── */
router.put('/:id', function (req, res) {
    var message = messageStore.find(function (m) { return m.id === req.params.id; });
    if (!message) {
        res.status(404).json({ success: false, error: 'Message not found' });
        return;
    }
    var _a = req.body, starred = _a.starred, status = _a.status, aiDraft = _a.aiDraft, priority = _a.priority;
    if (starred !== undefined)
        message.starred = starred;
    if (status)
        message.status = status;
    if (aiDraft)
        message.aiDraft = aiDraft;
    if (priority)
        message.priority = priority;
    res.json({ success: true, data: message });
});
/* ─── POST /api/messages/sync ──────────────────────────── */
router.post('/sync', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var results, newMessages, gmailConn, emails, err_3, slackConn, slackMsgs, err_4, teamsConn, teamsMsgs, err_5, _loop_1, _i, newMessages_1, msg, err_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 13, , 14]);
                results = [];
                newMessages = [];
                gmailConn = gmail_service_js_1.GmailService.getConnection();
                if (!(gmailConn.status === 'connected')) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, gmail_service_js_1.GmailService.fetchMessages(20)];
            case 2:
                emails = _a.sent();
                newMessages.push.apply(newMessages, emails);
                results.push({ channel: 'email', count: emails.length });
                return [3 /*break*/, 4];
            case 3:
                err_3 = _a.sent();
                results.push({
                    channel: 'email',
                    count: 0,
                    error: err_3 instanceof Error ? err_3.message : 'Sync failed',
                });
                return [3 /*break*/, 4];
            case 4:
                slackConn = slack_service_js_1.SlackService.getConnection();
                if (!(slackConn.status === 'connected')) return [3 /*break*/, 8];
                _a.label = 5;
            case 5:
                _a.trys.push([5, 7, , 8]);
                return [4 /*yield*/, slack_service_js_1.SlackService.fetchMessages(20)];
            case 6:
                slackMsgs = _a.sent();
                newMessages.push.apply(newMessages, slackMsgs);
                results.push({ channel: 'slack', count: slackMsgs.length });
                return [3 /*break*/, 8];
            case 7:
                err_4 = _a.sent();
                results.push({
                    channel: 'slack',
                    count: 0,
                    error: err_4 instanceof Error ? err_4.message : 'Sync failed',
                });
                return [3 /*break*/, 8];
            case 8:
                teamsConn = teams_service_js_1.TeamsService.getConnection();
                if (!(teamsConn.status === 'connected')) return [3 /*break*/, 12];
                _a.label = 9;
            case 9:
                _a.trys.push([9, 11, , 12]);
                return [4 /*yield*/, teams_service_js_1.TeamsService.fetchMessages(20)];
            case 10:
                teamsMsgs = _a.sent();
                newMessages.push.apply(newMessages, teamsMsgs);
                results.push({ channel: 'teams', count: teamsMsgs.length });
                return [3 /*break*/, 12];
            case 11:
                err_5 = _a.sent();
                results.push({
                    channel: 'teams',
                    count: 0,
                    error: err_5 instanceof Error ? err_5.message : 'Sync failed',
                });
                return [3 /*break*/, 12];
            case 12:
                _loop_1 = function (msg) {
                    var existing = messageStore.find(function (m) { return m.externalId === msg.externalId && m.channel === msg.channel; });
                    if (!existing) {
                        messageStore.push(msg);
                    }
                };
                // Merge: add new messages, update existing ones
                for (_i = 0, newMessages_1 = newMessages; _i < newMessages_1.length; _i++) {
                    msg = newMessages_1[_i];
                    _loop_1(msg);
                }
                // Sort by time
                messageStore.sort(function (a, b) { return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(); });
                lastSyncTime = new Date();
                res.json({
                    success: true,
                    data: {
                        results: results,
                        totalMessages: messageStore.length,
                        lastSync: lastSyncTime,
                    },
                });
                return [3 /*break*/, 14];
            case 13:
                err_6 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: err_6 instanceof Error ? err_6.message : 'Sync failed',
                });
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); });
/* ─── POST /api/messages/draft-all ─────────────────────── */
router.post('/draft-all', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var pendingMessages, results, batches, i, _i, batches_1, batch, batchResults, _a, batchResults_1, r, err_7;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                pendingMessages = messageStore.filter(function (m) { return m.status === 'pending'; });
                results = [];
                batches = [];
                for (i = 0; i < pendingMessages.length; i += 5) {
                    batches.push(pendingMessages.slice(i, i + 5));
                }
                _i = 0, batches_1 = batches;
                _b.label = 1;
            case 1:
                if (!(_i < batches_1.length)) return [3 /*break*/, 4];
                batch = batches_1[_i];
                return [4 /*yield*/, Promise.allSettled(batch.map(function (msg) { return __awaiter(void 0, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, ai_engine_js_1.AIEngine.generateResponse(msg)];
                                case 1:
                                    result = _a.sent();
                                    msg.aiDraft = result.draft;
                                    msg.aiConfidence = result.confidence;
                                    msg.status = 'ai_drafted';
                                    return [2 /*return*/, { messageId: msg.id, confidence: result.confidence }];
                            }
                        });
                    }); }))];
            case 2:
                batchResults = _b.sent();
                for (_a = 0, batchResults_1 = batchResults; _a < batchResults_1.length; _a++) {
                    r = batchResults_1[_a];
                    if (r.status === 'fulfilled') {
                        results.push(__assign(__assign({}, r.value), { success: true }));
                    }
                    else {
                        results.push({ messageId: 'unknown', success: false });
                    }
                }
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                res.json({
                    success: true,
                    data: {
                        processed: results.length,
                        successful: results.filter(function (r) { return r.success; }).length,
                        results: results,
                    },
                });
                return [3 /*break*/, 6];
            case 5:
                err_7 = _b.sent();
                res.status(500).json({
                    success: false,
                    error: err_7 instanceof Error ? err_7.message : 'Auto-draft failed',
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
