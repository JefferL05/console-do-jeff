'use client';

import { useState, useEffect } from 'react';

interface PostViewsProps {
  slug: string;
}

interface ViewsData {
  [key: string]: number;
}

const STORAGE_KEY = 'blog_views';
const CACHE_DURATION = 5 * 60 * 1000;

function getStoredViews(): ViewsData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return {};
}

function setStoredViews(views: ViewsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      data: views,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore localStorage errors
  }
}

export default function PostViews({ slug }: PostViewsProps) {
  const [views, setViews] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedViews = getStoredViews();
    
    if (storedViews[slug] !== undefined) {
      setViews(storedViews[slug]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch('/api/views.json', {
          signal: controller.signal
        });

        if (res.ok) {
          const data: ViewsData = await res.json();
          setStoredViews(data);
          setViews(data[slug] || 0);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setViews(0);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [slug]);

  if (loading) {
    return (
      <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
        <svg className="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="text-xs">--</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <span className="text-xs font-medium">
        {views !== null ? views.toLocaleString('pt-BR') : '0'}
      </span>
    </span>
  );
}
