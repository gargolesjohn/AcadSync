import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../store/auth';
import api from '../api/client';
import type { Message } from '../types';
import { formatDateTime, initials, toast } from '../utils';
import { Modal } from './Modal';
import EmojiPicker from 'emoji-picker-react';

const SUBJECT_PRESETS = [
  'Documents',
  'Scholarship',
  'Submission requirements',
  'Diploma',
  'Information update',
  'Others concerns',
];

export function MessagesView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'important' | 'spam'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [toId, setToId] = useState('');
  const [subject, setSubject] = useState('');
  const [isOtherSubject, setIsOtherSubject] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('All Subjects');
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Real-time Chat States
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Delete Modal States
  const [deleteModalMsgId, setDeleteModalMsgId] = useState<number | null>(null);
  const [unsendOption, setUnsendOption] = useState<'everyone' | 'you'>('everyone');

  // Responsiveness state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  useEffect(() => {
    fetchContacts();
  }, []);

  // Listen to custom event 'new-message-received' for real-time updates
  useEffect(() => {
    const handleNewMessage = (e: any) => {
      fetchMessages();
      const newMsg = e.detail;
      if (selectedContactId && selectedSubject) {
        // If we have an active chat, check if the incoming message belongs to it
        if (newMsg && (newMsg.from_id === selectedContactId || newMsg.to_id === selectedContactId) && newMsg.subject === selectedSubject) {
          fetchConversation(selectedContactId, selectedSubject);
        } else if (!newMsg) {
          // Fallback if detail is not provided
          fetchConversation(selectedContactId, selectedSubject);
        }
      }
    };
    window.addEventListener('new-message-received', handleNewMessage as EventListener);
    return () => {
      window.removeEventListener('new-message-received', handleNewMessage as EventListener);
    };
  }, [selectedContactId, selectedSubject, activeTab]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationMessages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/messages/${activeTab}?per_page=1000`);
      setMessages(data.data.items);
    } catch (err: any) {
      console.error('[MessagesView] Failed to fetch messages:', err);
      toast(err.response?.data?.detail || 'Failed to load messages', 'error', 'fa-exclamation-circle');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data } = await api.get('/users/contacts');
      setContacts(data.data);
    } catch (err: any) {
      console.error('[MessagesView] Failed to fetch contacts:', err);
      toast(err.response?.data?.detail || 'Failed to load contacts', 'error', 'fa-address-book');
    }
  };

  const fetchConversation = async (partnerId: string, subjectStr: string) => {
    setConversationLoading(true);
    try {
      const { data } = await api.get(`/messages/conversations/${partnerId}?subject=${encodeURIComponent(subjectStr)}`);
      setConversationMessages(data.data);
      // Refresh the message list because unread status might have changed (marked read by backend)
      const { data: listData } = await api.get(`/messages/${activeTab}?per_page=1000`);
      setMessages(listData.data.items);
    } catch (err: any) {
      console.error('[MessagesView] Failed to fetch conversation:', err);
      toast(err.response?.data?.detail || 'Failed to load conversation', 'error', 'fa-comments');
    } finally {
      setConversationLoading(false);
    }
  };

  const startConversation = (partnerId: string, partnerName: string, subjectStr: string) => {
    setSelectedContactId(partnerId);
    setSelectedContactName(partnerName);
    setSelectedSubject(subjectStr);
    fetchConversation(partnerId, subjectStr);
  };

  const handleSelectMsg = (m: Message) => {
    const isReceived = m.to_id === user?.id;
    const partnerId = isReceived ? m.from_id : m.to_id;
    const partnerName = isReceived ? m.from_name : m.to_name;
    startConversation(partnerId, partnerName, m.subject);
  };

  const handleSend = async () => {
    if (!toId || !subject.trim() || !body.trim()) {
      toast('Please fill in all fields', 'error', 'fa-exclamation-circle');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post('/messages', { to_id: toId, subject, body });
      toast('Message sent!', 'success', 'fa-check-circle');
      setShowCompose(false);

      // Find partner details
      const recipient = contacts.find(c => c.id === toId);
      const recipientName = recipient ? recipient.name : toId;

      const sentSubject = subject;
      setToId(''); setSubject(''); setBody(''); setIsOtherSubject(false);
      
      // Select the conversation we just started/resumed
      startConversation(toId, recipientName, sentSubject);
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to send', 'error', 'fa-times-circle');
    } finally {
      setSending(false);
    }
  };

  const handleSendChat = async () => {
    if (!selectedContactId || !chatInput.trim() || !selectedSubject) return;
    setSendingChat(true);
    try {
      const { data } = await api.post('/messages', {
        to_id: selectedContactId,
        subject: selectedSubject,
        body: chatInput,
      });

      setChatInput('');
      // Optimistically/instantly add the sent message to conversation history
      setConversationMessages(prev => [...prev, data.data]);
      
      // Silently refresh list
      const { data: listData } = await api.get(`/messages/${activeTab}?per_page=1000`);
      setMessages(listData.data.items);
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to send message', 'error', 'fa-times-circle');
    } finally {
      setSendingChat(false);
    }
  };

  const promptDeleteMessage = (msgId: number) => {
    setDeleteModalMsgId(msgId);
    setUnsendOption('everyone');
  };

  const confirmDeleteMessage = async () => {
    if (deleteModalMsgId === null) return;
    try {
      await api.delete(`/messages/${deleteModalMsgId}?for_everyone=${unsendOption === 'everyone'}`);
      toast('Message removed', 'success', 'fa-trash');
      if (unsendOption === 'everyone') {
        setConversationMessages(prev => prev.map(m => m.id === deleteModalMsgId ? { ...m, body: 'you unsent a message', is_unsent: true } : m));
      } else {
        setConversationMessages(prev => prev.filter(m => m.id !== deleteModalMsgId));
      }
      fetchMessages();
      setDeleteModalMsgId(null);
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Failed to remove', 'error', 'fa-times-circle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const toggleImportant = async (e: React.MouseEvent, m: Message) => {
    e.stopPropagation();
    try {
      await api.patch(`/messages/${m.id}/important`);
      toast(m.is_important ? 'Removed from important' : 'Marked as important', 'success', 'fa-star');
      fetchMessages();
      if (selectedContactId && selectedSubject) fetchConversation(selectedContactId, selectedSubject);
    } catch (err) {
      toast('Failed to update', 'error', 'fa-times');
    }
  };

  const toggleSpam = async (e: React.MouseEvent, m: Message) => {
    e.stopPropagation();
    try {
      await api.patch(`/messages/${m.id}/spam`);
      toast(m.is_spam ? 'Moved to inbox' : 'Marked as spam', 'info', 'fa-ban');
      fetchMessages();
      if (selectedContactId && selectedSubject) fetchConversation(selectedContactId, selectedSubject);
    } catch (err) {
      toast('Failed to update', 'error', 'fa-times');
    }
  };

  const filteredMessages = messages.filter(m => {
    const matchesSubject = subjectFilter === 'All Subjects' || m.subject === subjectFilter;
    const matchesSearch = !search || 
      m.subject.toLowerCase().includes(search.toLowerCase()) || 
      m.body.toLowerCase().includes(search.toLowerCase()) ||
      m.from_name.toLowerCase().includes(search.toLowerCase()) ||
      m.to_name.toLowerCase().includes(search.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const conversationGroups = new Map<string, Message>();
  
  filteredMessages.forEach(m => {
    const isReceived = m.to_id === user?.id;
    const partnerId = isReceived ? m.from_id : m.to_id;
    const convoKey = `${partnerId}-${m.subject}`;
    
    if (!conversationGroups.has(convoKey)) {
      conversationGroups.set(convoKey, m);
    } else {
      const existing = conversationGroups.get(convoKey)!;
      if (!m.is_read && m.to_id === user?.id) {
        if (existing.is_read || existing.to_id !== user?.id) {
          conversationGroups.set(convoKey, { ...existing, is_read: false });
        }
      }
    }
  });

  const displayMessages = Array.from(conversationGroups.values());

  const uniqueSubjects = Array.from(new Set(messages.map(m => m.subject))).sort();

  const renderMsgItem = (m: Message) => {
    const isReceived = m.to_id === user?.id;
    const partnerId = isReceived ? m.from_id : m.to_id;
    const partnerName = isReceived ? m.from_name : m.to_name;
    const isActive = selectedContactId === partnerId && selectedSubject === m.subject;

    return (
      <div 
        key={m.id} 
        className={`msg-card-item ${!m.is_read && isReceived ? 'unread' : ''}`} 
        onClick={() => handleSelectMsg(m)}
        style={{
          background: isActive ? 'color-mix(in srgb, var(--accent) 06%, transparent)' : undefined,
          borderLeft: isActive ? '3px solid var(--accent)' : undefined
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'start' }}>
          <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '12px', flexShrink: 0 }}>
            {initials(isReceived ? m.from_name : m.to_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isReceived ? m.from_name : `To: ${m.to_name}`}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatDateTime(m.created_at)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 08%, transparent)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {m.subject}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: (!m.is_read && isReceived) ? 600 : 400 }}>
              {m.body}
            </div>
          </div>
          <div className="msg-actions" style={{ display: 'flex', gap: '4px' }}>
            {isReceived && (
              <>
                <button onClick={(e) => toggleImportant(e, m)} className="action-btn" style={{ color: m.is_important ? '#f59e0b' : 'var(--text-muted)' }}>
                  <i className={m.is_important ? 'fas fa-star' : 'far fa-star'}></i>
                </button>
                <button onClick={(e) => toggleSpam(e, m)} className="action-btn hover-red" style={{ color: m.is_spam ? '#ef4444' : 'var(--text-muted)' }}>
                  <i className="fas fa-ban"></i>
                </button>
              </>
            )}
          </div>
        </div>
        {!m.is_read && isReceived && <div className="unread-indicator"></div>}
      </div>
    );
  };

  const currentSubject = selectedSubject || 'General Inquiry';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Messages</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Campus Communication Hub</p>
        </div>
        <button className="btn-primary" style={{ padding: '12px 24px', borderRadius: '14px', boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent)' }} onClick={() => setShowCompose(true)}>
          <i className="fas fa-plus" style={{ marginRight: '8px' }}></i>Compose
        </button>
      </div>

      <div className="messages-layout" style={{ gridTemplateColumns: (!isMobile && selectedContactId) ? '1fr' : undefined }}>
        {/* Unified Sidebar + List Container */}
        <div className="card messages-container" style={{ height: '620px' }}>
          {/* Sidebar (Hide on mobile if chat is active) */}
          {(!isMobile || !selectedContactId) && (
            <div className="messages-sidebar">
              {[
                { id: 'inbox', label: 'Inbox', icon: 'fa-inbox', color: 'var(--accent)' },
                { id: 'sent', label: 'Sent', icon: 'fa-paper-plane', color: '#10b981' },
                { id: 'important', label: 'Important', icon: 'fa-star', color: '#f59e0b' },
                { id: 'spam', label: 'Spam', icon: 'fa-ban', color: '#ef4444' },
              ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSubjectFilter('All Subjects'); }} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', borderRadius: '12px',
                  background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', color: activeTab === tab.id ? tab.color : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: activeTab === tab.id ? 800 : 600, cursor: 'pointer', textAlign: 'left', marginBottom: '6px',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s'
                }}>
                  <i className={`fas ${tab.icon}`} style={{ width: '18px', fontSize: '16px' }}></i> {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* List Area (Hide on mobile if chat is active) */}
          {(!isMobile || !selectedContactId) && (
            <div className="messages-list-area" style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}></i>
                  <input className="input" style={{ paddingLeft: '36px', height: '36px', fontSize: '13px', borderRadius: '10px' }} placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input" style={{ width: '160px', height: '36px', fontSize: '12px', borderRadius: '10px', padding: '0 10px' }} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                  <option>All Subjects</option>
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-circle-notch fa-spin fa-2x" style={{ marginBottom: '12px' }}></i>
                    <div>Syncing messages...</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {displayMessages.length > 0 ? displayMessages.map(m => renderMsgItem(m)) : (
                      <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <i className="fas fa-envelope-open" style={{ fontSize: '48px', opacity: 0.1, marginBottom: '16px' }}></i>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>No messages found in {activeTab}</div>
                        <p style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your search or filters</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Area */}
          {(!isMobile || selectedContactId) && (
            selectedContactId ? (
              <div className="messages-chat-area" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
                {/* Chat Header */}
                <div className="chat-header">
                  <div className="chat-header-user">
                    <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '8px' }} onClick={() => setSelectedContactId(null)}>
                      <i className="fas fa-chevron-left"></i> Back
                    </button>
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '12px' }}>
                      {initials(selectedContactName || '')}
                    </div>
                    <div className="chat-header-info">
                      <span className="chat-header-name">{selectedContactName}</span>
                      <span className="chat-header-status" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'inline-block', marginTop: '4px' }}>
                        SUBJECT: {currentSubject}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chat Bubbles */}
                <div className="chat-bubbles-container" ref={chatContainerRef} style={{ flexGrow: 1, overflowY: 'auto' }}>
                  {conversationLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <i className="fas fa-circle-notch fa-spin fa-2x" style={{ marginBottom: '12px' }}></i>
                      <div>Loading conversation...</div>
                    </div>
                  ) : conversationMessages.length > 0 ? (
                    conversationMessages.map(m => {
                      const isSent = m.from_id === user?.id;
                      return (
                        <div key={m.id} className={`chat-bubble ${isSent ? 'sent' : 'received'}`} style={m.is_unsent ? { opacity: 0.6, fontStyle: 'italic', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' } : {}}>
                          <div className="msg-bubble-wrap">
                            {m.body}
                          </div>
                          <div className="chat-bubble-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span>{formatDateTime(m.created_at)}</span>
                            <button onClick={() => promptDeleteMessage(m.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7, padding: 0 }} title="Delete Message">
                              <i className="fas fa-trash-alt" style={{ fontSize: '10px' }}></i>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <i className="fas fa-comments" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.15 }}></i>
                      <div>No messages in this conversation yet.</div>
                    </div>
                  )}
                </div>

                {/* Chat Reply Panel */}
                <div className="chat-reply-panel" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {showEmojiPicker && (
                    <div style={{ position: 'absolute', bottom: '100%', right: '20px', zIndex: 1000, marginBottom: '10px' }}>
                      <EmojiPicker onEmojiClick={(emojiData) => {
                        setChatInput(prev => prev + emojiData.emoji);
                        setShowEmojiPicker(false);
                      }} />
                    </div>
                  )}
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
                    <i className="far fa-smile"></i>
                  </button>
                  <textarea
                    className="input"
                    rows={1}
                    placeholder="Type your message..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ resize: 'none', borderRadius: '10px', height: '38px', padding: '8px 12px', flex: 1 }}
                  />
                  <button className="btn-primary" style={{ padding: '9px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSendChat} disabled={sendingChat || !chatInput.trim()}>
                    {sendingChat ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                    <span>Send</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="messages-chat-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', color: 'var(--text-muted)', flex: 1.5 }}>
                <i className="fas fa-comments" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}></i>
                <div style={{ fontWeight: 600 }}>No conversation selected</div>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Choose a message thread or quick contact to begin</p>
              </div>
            )
          )}
        </div>

        {/* Contacts Panel */}
        {!selectedContactId && (
          <div className="card messages-contacts">
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff7ed', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-address-book"></i>
              </div>
              Quick Contacts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
              {contacts.map(ct => (
              <button key={ct.id} className="contact-item-btn" onClick={() => {
                setToId(ct.id);
                setShowCompose(true);
              }}>
                <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '11px' }}>{initials(ct.name)}</div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ct.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ct.role}</div>
                </div>
                <i className="fas fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.3 }}></i>
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <Modal onClose={() => { setShowCompose(false); setIsOtherSubject(false); }} title="Compose Message" icon="fa-pen" iconColor="var(--accent)">
          <div style={{ marginBottom: 16 }}>
            <label className="label">To</label>
            <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
              <option value="">Select recipient...</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Subject</label>
            {user?.role === 'student' && !isOtherSubject ? (
              <select className="input" value={subject} onChange={e => {
                if (e.target.value === 'OTHER') { setIsOtherSubject(true); setSubject(''); }
                else { setSubject(e.target.value); }
              }}>
                <option value="">Select a subject...</option>
                {SUBJECT_PRESETS.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="OTHER">Other...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" placeholder="Type custom subject" value={subject} onChange={e => setSubject(e.target.value)} autoFocus />
                {user?.role === 'student' && (
                  <button className="btn-secondary" style={{ padding: '0 12px' }} onClick={() => { setIsOtherSubject(false); setSubject(''); }}>Back</button>
                )}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Message</label>
            <textarea className="input" rows={5} placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowCompose(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }}></i>Send</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Custom Delete Modal */}
      {deleteModalMsgId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#242526', width: '500px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 28px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: '36px' }}></div>
              <h3 style={{ margin: 0, color: '#e4e6eb', fontSize: '20px', fontWeight: 700 }}>Who do you want to unsend this message for?</h3>
              <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', color: '#b0b3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDeleteModalMsgId(null)}>
                <i className="fas fa-times" style={{ fontSize: '18px' }}></i>
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              {(() => {
                const msgToDelete = conversationMessages.find(m => m.id === deleteModalMsgId) || messages.find(m => m.id === deleteModalMsgId);
                const isSentByMe = msgToDelete?.from_id === user?.id;
                
                return (
                  <>
                    {isSentByMe && (
                      <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', marginBottom: '20px' }}>
                        <input type="radio" name="unsendOption" checked={unsendOption === 'everyone'} onChange={() => setUnsendOption('everyone')} style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#2d88ff' }} />
                        <div>
                          <div style={{ color: '#e4e6eb', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Unsend for everyone</div>
                          <div style={{ color: '#b0b3b8', fontSize: '13px', lineHeight: '1.4' }}>This message will be unsent for everyone in the chat. Others may have already seen or forwarded it. Unsent messages can still be included in reports.</div>
                        </div>
                      </label>
                    )}

                    <label style={{ display: 'flex', gap: '12px', cursor: 'pointer' }}>
                      <input type="radio" name="unsendOption" checked={!isSentByMe || unsendOption === 'you'} onChange={() => setUnsendOption('you')} style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#2d88ff' }} />
                      <div>
                        <div style={{ color: '#e4e6eb', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Unsend for you</div>
                        <div style={{ color: '#b0b3b8', fontSize: '13px', lineHeight: '1.4' }}>This message will be removed for you. Others in the chat will still be able to see it.</div>
                      </div>
                    </label>
                  </>
                );
              })()}
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button style={{ background: 'transparent', border: 'none', color: '#2d88ff', fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontSize: '15px' }} onClick={() => setDeleteModalMsgId(null)}>Cancel</button>
              <button style={{ background: '#2d88ff', border: 'none', color: '#fff', fontWeight: 600, padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' }} onClick={confirmDeleteMessage}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
