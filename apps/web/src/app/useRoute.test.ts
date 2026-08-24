/**
 * Tests for useRoute and navigate — SPA routing without react-router.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { navigate, useRoute } from './useRoute';

function setPathname(pathname: string) {
  window.history.pushState(null, '', pathname);
}

describe('useRoute', () => {
  // Restore original pathname between tests.
  let originalPathname: string;
  beforeEach(() => {
    originalPathname = window.location.pathname;
  });
  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  it('returns "expedientes" for /expedientes on initial mount (direct navigation)', () => {
    setPathname('/expedientes');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('expedientes');
  });

  it('returns "preparacion" for /preparacion on initial mount (direct navigation)', () => {
    setPathname('/preparacion');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('preparacion');
  });

  it('returns "dashboard" for / on initial mount', () => {
    setPathname('/');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('dashboard');
  });

  it('returns "not-found" for an unknown path', () => {
    setPathname('/solicitudes');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('not-found');
  });

  it('updates route when navigate() is called', () => {
    setPathname('/expedientes');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('expedientes');

    act(() => { navigate('/preparacion'); });
    expect(result.current).toBe('preparacion');
  });

  it('updates route when navigate() is called back to /expedientes', () => {
    setPathname('/preparacion');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('preparacion');

    act(() => { navigate('/expedientes'); });
    expect(result.current).toBe('expedientes');
  });

  it('updates route when browser back/forward fires popstate', () => {
    setPathname('/expedientes');
    const { result } = renderHook(() => useRoute());

    act(() => {
      // Simulate browser back by pushing state then dispatching popstate
      window.history.pushState(null, '', '/preparacion');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('preparacion');
  });

  it('multiple rapid navigations land on the final route', () => {
    setPathname('/');
    const { result } = renderHook(() => useRoute());

    act(() => { navigate('/preparacion'); });
    act(() => { navigate('/expedientes'); });
    act(() => { navigate('/preparacion'); });

    expect(result.current).toBe('preparacion');
  });
});

describe('navigate', () => {
  let originalPathname: string;
  beforeEach(() => { originalPathname = window.location.pathname; });
  afterEach(() => { window.history.replaceState(null, '', originalPathname); });

  it('updates window.location.pathname', () => {
    navigate('/preparacion');
    expect(window.location.pathname).toBe('/preparacion');
  });

  it('dispatches popstate so listeners react', () => {
    let fired = false;
    function handler() { fired = true; }
    window.addEventListener('popstate', handler);
    navigate('/expedientes');
    window.removeEventListener('popstate', handler);
    expect(fired).toBe(true);
  });
});
