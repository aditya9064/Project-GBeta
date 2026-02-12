import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTeamChat, ChatMessage, Channel, getAvatarColor, formatMessageText } from '../../hooks/useTeamChat';

interface TeamChatProps {
  teamId: string;
  teamName: string;
}

// Icons
const Icons = {
  Hash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22,2 15,22 11,13 2,9"/>
    </svg>
  ),
  Smile: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  AtSign: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
    </svg>
  ),
  Paperclip: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  MoreHorizontal: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  Reply: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,17 4,12 9,7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"/>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  MessageCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  Bold: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    </svg>
  ),
  Italic: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="4" x2="10" y2="4"/>
      <line x1="14" y1="20" x2="5" y2="20"/>
      <line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  ),
  Code: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16,18 22,12 16,6"/>
      <polyline points="8,6 2,12 8,18"/>
    </svg>
  ),
};

// Common emoji reactions
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀', '👀', '💯', '🙌'];

// Format time
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date for message groups
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
};

// Group messages by date and sender
interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

export function TeamChat({ teamId, teamName }: TeamChatProps) {
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    channels,
    pinnedMessages,
    typingUsers,
    onlineUsers,
    loading,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    togglePinMessage,
    createChannel,
    sendTypingIndicator,
    searchMessages,
    currentUserId,
  } = useTeamChat(teamId, activeChannel);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages by date
  const groupedMessages = useMemo((): MessageGroup[] => {
    const displayMessages = isSearching ? searchMessages(searchQuery) : messages;
    const groups: MessageGroup[] = [];
    let currentDate = '';

    displayMessages.forEach((msg) => {
      const dateStr = formatDateHeader(msg.createdAt);
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  }, [messages, isSearching, searchQuery, searchMessages]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    if (editingMessage) {
      await editMessage(editingMessage.id, messageText);
      setEditingMessage(null);
    } else {
      await sendMessage(messageText, 'message', replyingTo || undefined);
      setReplyingTo(null);
    }
    setMessageText('');
    inputRef.current?.focus();
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle typing
  const handleTyping = () => {
    sendTypingIndicator();
  };

  // Handle create channel
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    
    await createChannel(newChannelName, newChannelDesc, newChannelPrivate);
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelPrivate(false);
    setShowChannelModal(false);
  };

  // Handle edit message
  const handleEditMessage = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setMessageText(msg.text);
    inputRef.current?.focus();
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessage(null);
    setMessageText('');
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Insert formatting
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = messageText;
    const selectedText = text.substring(start, end);

    const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
    setMessageText(newText);

    // Set cursor position after formatting
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + prefix.length + selectedText.length + suffix.length;
      input.focus();
    }, 0);
  };

  // Get typing users text
  const getTypingText = useCallback(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  }, [typingUsers]);

  // Get active channel info
  const activeChannelInfo = channels.find(c => c.id === activeChannel || c.name === activeChannel);

  // Get online count
  const onlineCount = onlineUsers.filter(u => u.status === 'online').length;

  return (
    <div className="team-chat">
      {/* Channel Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3 className="chat-team-name">{teamName}</h3>
          <div className="online-indicator">
            <span className="online-dot"></span>
            <span>{onlineCount} online</span>
          </div>
        </div>

        {/* Search */}
        <div className="chat-search">
          <Icons.Search />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(e.target.value.length > 0);
            }}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { setSearchQuery(''); setIsSearching(false); }}>
              <Icons.X />
            </button>
          )}
        </div>

        {/* Channels Section */}
        <div className="chat-section">
          <div className="section-header">
            <span>Channels</span>
            <button className="section-add-btn" onClick={() => setShowChannelModal(true)} title="Create channel">
              <Icons.Plus />
            </button>
          </div>
          <div className="channel-list">
            {channels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item ${(activeChannel === channel.id || activeChannel === channel.name) ? 'active' : ''}`}
                onClick={() => setActiveChannel(channel.id)}
              >
                {channel.isPrivate ? <Icons.Lock /> : <Icons.Hash />}
                <span className="channel-name">{channel.name}</span>
                {channel.unreadCount && channel.unreadCount > 0 && (
                  <span className="unread-badge">{channel.unreadCount}</span>
                )}
              </button>
            ))}
            {channels.length === 0 && (
              <div className="empty-channels">
                <p>No channels yet</p>
                <button className="create-channel-btn" onClick={() => setShowChannelModal(true)}>
                  <Icons.Plus />
                  <span>Create a channel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && (
          <div className="chat-section">
            <button 
              className="section-header clickable"
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            >
              <span>📌 Pinned Messages ({pinnedMessages.length})</span>
            </button>
            {showPinnedMessages && (
              <div className="pinned-list">
                {pinnedMessages.map((msg) => (
                  <div key={msg.id} className="pinned-item" onClick={() => {
                    // Scroll to message
                    const element = document.getElementById(`msg-${msg.id}`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}>
                    <span className="pinned-sender">{msg.senderName}</span>
                    <span className="pinned-text">{msg.text.slice(0, 50)}...</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Online Members */}
        <div className="chat-section">
          <div className="section-header">
            <span>Team Members</span>
            <Icons.Users />
          </div>
          <div className="members-list">
            {onlineUsers.map((user) => (
              <div key={user.odfserId} className="member-item">
                <div className="member-avatar" style={{ backgroundColor: getAvatarColor(user.name) }}>
                  {user.name.charAt(0).toUpperCase()}
                  <span className={`status-indicator ${user.status}`}></span>
                </div>
                <div className="member-info">
                  <span className="member-name">{user.name}</span>
                  {user.statusMessage && (
                    <span className="member-status-msg">{user.statusMessage}</span>
                  )}
                </div>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <div className="empty-members">
                <p>No team members online</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {/* Channel Header */}
        <header className="chat-header">
          <div className="chat-header-left">
            {activeChannelInfo?.isPrivate ? <Icons.Lock /> : <Icons.Hash />}
            <h2 className="channel-title">{activeChannelInfo?.name || 'general'}</h2>
            {activeChannelInfo?.description && (
              <span className="channel-description">{activeChannelInfo.description}</span>
            )}
          </div>
          <div className="chat-header-right">
            <button className="header-btn" title="Members">
              <Icons.Users />
              <span>{onlineCount}</span>
            </button>
            <button 
              className={`header-btn ${showPinnedMessages ? 'active' : ''}`} 
              title="Pinned messages"
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            >
              <Icons.Pin />
              {pinnedMessages.length > 0 && <span>{pinnedMessages.length}</span>}
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="messages-container">
          {loading ? (
            <div className="messages-loading">
              <div className="loading-spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="messages-empty">
              <div className="empty-icon">
                <Icons.MessageCircle />
              </div>
              <h3>No messages yet</h3>
              <p>Be the first to send a message in #{activeChannelInfo?.name || 'general'}</p>
            </div>
          ) : (
            groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex} className="message-group">
                <div className="date-divider">
                  <span>{group.date}</span>
                </div>
                {group.messages.map((msg, msgIndex) => {
                  const isOwnMessage = msg.senderId === currentUserId;
                  const showAvatar = msgIndex === 0 || 
                    group.messages[msgIndex - 1].senderId !== msg.senderId ||
                    (msg.createdAt.getTime() - group.messages[msgIndex - 1].createdAt.getTime()) > 300000;

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`message ${msg.type} ${isOwnMessage ? 'own' : ''} ${msg.isPinned ? 'pinned' : ''} ${hoveredMessage === msg.id ? 'hovered' : ''}`}
                      onMouseEnter={() => setHoveredMessage(msg.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      {/* Reply indicator */}
                      {msg.replyTo && (
                        <div className="message-reply-indicator">
                          <Icons.Reply />
                          <span>Replying to {msg.replyToSender}</span>
                          <span className="reply-preview">{msg.replyToText}</span>
                        </div>
                      )}

                      <div className="message-content">
                        {showAvatar && (
                          <div 
                            className="message-avatar" 
                            style={{ backgroundColor: getAvatarColor(msg.senderName) }}
                          >
                            {msg.type === 'system' ? '🔔' : msg.senderAvatar}
                          </div>
                        )}
                        {!showAvatar && <div className="message-avatar-spacer"></div>}

                        <div className="message-body">
                          {showAvatar && (
                            <div className="message-header">
                              <span className="sender-name">{msg.senderName}</span>
                              <span className="message-time">{formatTime(msg.createdAt)}</span>
                              {msg.editedAt && <span className="edited-label">(edited)</span>}
                              {msg.isPinned && <span className="pinned-label">📌</span>}
                            </div>
                          )}
                          <div 
                            className="message-text"
                            dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                          />

                          {/* Reactions */}
                          {Object.keys(msg.reactions).length > 0 && (
                            <div className="message-reactions">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  className={`reaction-btn ${users.includes(currentUserId || '') ? 'active' : ''}`}
                                  onClick={() => addReaction(msg.id, emoji)}
                                  title={users.length + ' reaction(s)'}
                                >
                                  <span className="reaction-emoji">{emoji}</span>
                                  <span className="reaction-count">{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Message Actions */}
                        {hoveredMessage === msg.id && msg.type !== 'system' && (
                          <div className="message-actions">
                            <button 
                              className="action-btn" 
                              title="Add reaction"
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                            >
                              <Icons.Smile />
                            </button>
                            <button 
                              className="action-btn" 
                              title="Reply"
                              onClick={() => {
                                setReplyingTo(msg);
                                inputRef.current?.focus();
                              }}
                            >
                              <Icons.Reply />
                            </button>
                            <button 
                              className="action-btn" 
                              title={msg.isPinned ? 'Unpin' : 'Pin'}
                              onClick={() => togglePinMessage(msg.id)}
                            >
                              <Icons.Pin />
                            </button>
                            {isOwnMessage && (
                              <>
                                <button 
                                  className="action-btn" 
                                  title="Edit"
                                  onClick={() => handleEditMessage(msg)}
                                >
                                  <Icons.Edit />
                                </button>
                                <button 
                                  className="action-btn danger" 
                                  title="Delete"
                                  onClick={() => deleteMessage(msg.id)}
                                >
                                  <Icons.Trash />
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === msg.id && (
                          <div className="emoji-picker">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                className="emoji-btn"
                                onClick={() => {
                                  addReaction(msg.id, emoji);
                                  setShowEmojiPicker(null);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing Indicator */}
        {getTypingText() && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>{getTypingText()}</span>
          </div>
        )}

        {/* Reply/Edit Banner */}
        {(replyingTo || editingMessage) && (
          <div className="compose-banner">
            <div className="banner-content">
              {replyingTo && (
                <>
                  <Icons.Reply />
                  <span>Replying to <strong>{replyingTo.senderName}</strong></span>
                  <span className="banner-preview">{replyingTo.text.slice(0, 50)}...</span>
                </>
              )}
              {editingMessage && (
                <>
                  <Icons.Edit />
                  <span>Editing message</span>
                </>
              )}
            </div>
            <button className="banner-close" onClick={replyingTo ? cancelReply : cancelEditing}>
              <Icons.X />
            </button>
          </div>
        )}

        {/* Message Composer */}
        <div className="message-composer">
          <div className="composer-toolbar">
            <button className="toolbar-btn" title="Bold" onClick={() => insertFormatting('*')}>
              <Icons.Bold />
            </button>
            <button className="toolbar-btn" title="Italic" onClick={() => insertFormatting('_')}>
              <Icons.Italic />
            </button>
            <button className="toolbar-btn" title="Code" onClick={() => insertFormatting('`')}>
              <Icons.Code />
            </button>
            <div className="toolbar-divider"></div>
            <button className="toolbar-btn" title="Mention someone">
              <Icons.AtSign />
            </button>
            <button className="toolbar-btn" title="Add emoji">
              <Icons.Smile />
            </button>
            <button className="toolbar-btn" title="Attach file">
              <Icons.Paperclip />
            </button>
          </div>
          <div className="composer-input-wrapper">
            <textarea
              ref={inputRef}
              className="composer-input"
              placeholder={`Message #${activeChannelInfo?.name || 'general'}`}
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyPress}
              rows={1}
            />
            <button 
              className={`send-btn ${messageText.trim() ? 'active' : ''}`}
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
            >
              <Icons.Send />
            </button>
          </div>
          <div className="composer-hint">
            <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
          </div>
        </div>
      </main>

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="modal-overlay" onClick={() => setShowChannelModal(false)}>
          <div className="modal channel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create a Channel</h3>
              <button className="modal-close" onClick={() => setShowChannelModal(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Channel Name</label>
                <div className="input-with-prefix">
                  <span className="input-prefix">#</span>
                  <input
                    type="text"
                    placeholder="e.g. marketing"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  placeholder="What's this channel about?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newChannelPrivate}
                    onChange={(e) => setNewChannelPrivate(e.target.checked)}
                  />
                  <Icons.Lock />
                  <span>Make private</span>
                </label>
                <p className="form-hint">Private channels can only be viewed or joined by invitation.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowChannelModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







