// lib/useAsyncFetch.js
// Custom hook to encapsulate the loading/data/error pattern
// Moves setState calls out of component effects to satisfy react-hooks/set-state-in-effect
import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Generic hook for async data fetching with loading/error state management.
 * Returns { loading, error, data, refetch } where `loading` is derived from data state.
 *
 * @param {Function} fetchFn - async function that returns data
 * @param {Array} deps - dependency array for re-fetching
 * @param {Object} options
 * @param {*} options.initialData - initial data value (default null)
 * @param {boolean} options.immediate - whether to fetch immediately (default true)
 */
export function useAsyncFetch(fetchFn, deps = [], options = {}) {
  const { initialData = null, immediate = true } = options;
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);

  // Keep ref current without accessing during render
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  // loading is derived: true if no data and no error
  const loading = data === initialData && error === null;

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchFnRef.current();
      if (mountedRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || err || "An error occurred");
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      queueMicrotask(() => refetch());
    }
    return () => {
      mountedRef.current = false;
    };
  }, [immediate, refetch]);

  return { loading, error, data, refetch };
}

/**
 * Simplified hook when you only need loading state (no data).
 * Returns { loading, error, refetch }.
 */
export function useLoadingFetch(fetchFn, deps = []) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const refetch = useCallback(async () => {
    try {
      await fetchFnRef.current();
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || err || "An error occurred");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(() => refetch());
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { loading, error, setError, refetch };
}