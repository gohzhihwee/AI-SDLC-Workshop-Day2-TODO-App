'use client';

import { useEffect } from 'react';

type NotificationTodo = {
  id: number;
  title: string;
  due_date: string | null;
};

export function useNotifications(enabled: boolean, onNotify?: (items: NotificationTodo[]) => void) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    let cancelled = false;
    let interval: number | null = null;

    const ensurePermission = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };

    const poll = async () => {
      if (Notification.permission === 'denied') {
        return;
      }

      const response = await fetch('/api/notifications/check');
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { notifications: NotificationTodo[] };
      if (cancelled || data.notifications.length === 0) {
        return;
      }

      data.notifications.forEach((todo) => {
        if (Notification.permission === 'granted') {
          new Notification('Todo reminder', {
            body: todo.title,
            tag: `todo-${todo.id}`,
          });
        }
      });
      onNotify?.(data.notifications);
    };

    void ensurePermission().then(() => {
      void poll();
      interval = window.setInterval(() => {
        void poll();
      }, 30_000);
    });

    return () => {
      cancelled = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [enabled, onNotify]);
}
