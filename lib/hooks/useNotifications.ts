'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type NotificationTodo = {
  id: number;
  title: string;
  due_date: string | null;
};

export function useNotifications(enabled: boolean, onNotify?: (items: NotificationTodo[]) => void) {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  );
  const onNotifyRef = useRef(onNotify);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (!enabled || permission !== 'granted' || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    let cancelled = false;
    let interval: number | null = null;

    const poll = async () => {
      const currentPermission = Notification.permission;
      if (currentPermission !== permission) {
        setPermission(currentPermission);
      }
      if (currentPermission !== 'granted') {
        return;
      }

      try {
        const response = await fetch('/api/notifications/check');
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { notifications: NotificationTodo[] };
        if (cancelled || data.notifications.length === 0) {
          return;
        }

        for (const todo of data.notifications) {
          new Notification('Todo reminder', {
            body: todo.title,
            tag: `todo-${todo.id}`,
          });
          await fetch(`/api/todos/${todo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_notification_sent: new Date().toISOString() }),
          });
        }
        onNotifyRef.current?.(data.notifications);
      } catch (error) {
        console.error('Unable to check todo reminders', error);
      }
    };

    void poll();
    interval = window.setInterval(() => {
      void poll();
    }, 30_000);

    return () => {
      cancelled = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [enabled, permission]);

  return { permission, requestPermission };
}
