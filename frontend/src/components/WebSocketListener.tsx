import { useEffect, useRef } from 'react';
import { useAuth } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { toast } from '../utils';

export function WebSocketListener() {
  const { token, user } = useAuth();
  const { incrementUnreadCount } = useNotifications();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    function connect() {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = import.meta.env.DEV ? `${window.location.hostname}:8000` : window.location.host;
      const wsUrl = `${protocol}//${host}/ws?token=${token}`;

      console.log('[WS] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected successfully');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WS] Received message:', message);

          if (message.type === 'new_message') {
            const msg = message.data;
            // Play notification or display toast
            toast(`New Message from ${msg.from_name}: ${msg.subject}`, 'info', 'fa-envelope');
            
            // Increment unread count globally
            incrementUnreadCount();

            // Dispatch global event for MessagesView to refresh
            window.dispatchEvent(new CustomEvent('new-message-received', { detail: msg }));
          } 
          else if (message.type === 'new_announcement') {
            const ann = message.data;
            toast(`New Announcement: ${ann.title}`, 'success', 'fa-bullhorn');
            
            // Dispatch global event for AnnouncementsView to refresh
            window.dispatchEvent(new CustomEvent('new-announcement-received', { detail: ann }));
          }
          else if (message.type === 'grade_updated') {
            const grade = message.data;
            if (user?.role === 'student') {
              toast(`Grade updated: ${grade.subject}`, 'info', 'fa-star');
            }
            window.dispatchEvent(new CustomEvent('grade-updated', { detail: grade }));
          }
          else if (message.type === 'assignment_updated') {
            const assignment = message.data;
            if (user?.role === 'instructor' || user?.role === 'program_head') {
              if (assignment.event === 'submission_submitted') {
                toast(`New submission: ${assignment.assignment_title}`, 'info', 'fa-file-upload');
              } else if (assignment.event === 'submission_graded') {
                toast(`Submission graded: ${assignment.assignment_title}`, 'success', 'fa-check-circle');
              }
            }
            window.dispatchEvent(new CustomEvent('assignment-updated', { detail: assignment }));
          }
        } catch (err) {
          console.error('[WS] Failed to parse message', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Socket error:', err);
      };

      ws.onclose = (event) => {
        console.log('[WS] Socket closed:', event.code, event.reason);
        // Automatic reconnection with timeout ONLY if still mounted
        if (token && user && isMountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            console.log('[WS] Reconnecting...');
            connect();
          }, 3000);
        }
      };
    }

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        // Only attempt to close if it's connected to avoid the 1006 'closed before established' error
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
        socketRef.current = null;
      }
    };
  }, [token, user, incrementUnreadCount]);

  return null;
}
