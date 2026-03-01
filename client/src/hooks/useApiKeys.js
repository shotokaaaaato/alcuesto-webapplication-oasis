import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "oasis_ak_";
const STORAGE_MODE_KEY = "oasis_ak_mode";

const PROVIDERS = ["deepseek", "openai", "claude", "gemini", "perplexity", "figma"];

function encode(value) {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "";
  }
}

function decode(encoded) {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return "";
  }
}

/**
 * API キー管理フック
 * - persistent: localStorage に base64 エンコードして保存
 * - session: React state のみ（ページリロードで消失）
 */
export function useApiKeys() {
  const [storageMode, setStorageModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_MODE_KEY) || "persistent";
    } catch {
      return "persistent";
    }
  });

  const [sessionKeys, setSessionKeys] = useState({});

  // persistent モードで初期ロード
  const [persistedKeys, setPersistedKeys] = useState(() => {
    const keys = {};
    if (typeof window === "undefined") return keys;
    try {
      for (const p of PROVIDERS) {
        const raw = localStorage.getItem(STORAGE_PREFIX + p);
        if (raw) keys[p] = decode(raw);
      }
      // 旧 FigmaTokenInput からの移行
      if (!keys.figma) {
        const oldFigma = localStorage.getItem("oasis_figma_token");
        if (oldFigma) {
          const decoded = decode(oldFigma);
          if (decoded) {
            keys.figma = decoded;
            localStorage.setItem(STORAGE_PREFIX + "figma", oldFigma);
            localStorage.removeItem("oasis_figma_token");
          }
        }
      }
    } catch {
      // ignore
    }
    return keys;
  });

  const getKey = useCallback(
    (provider) => {
      if (storageMode === "session") {
        return sessionKeys[provider] || "";
      }
      return persistedKeys[provider] || "";
    },
    [storageMode, sessionKeys, persistedKeys]
  );

  const setKey = useCallback(
    (provider, value) => {
      if (storageMode === "session") {
        setSessionKeys((prev) => ({ ...prev, [provider]: value }));
      } else {
        setPersistedKeys((prev) => ({ ...prev, [provider]: value }));
        try {
          if (value) {
            localStorage.setItem(STORAGE_PREFIX + provider, encode(value));
          } else {
            localStorage.removeItem(STORAGE_PREFIX + provider);
          }
        } catch {
          // ignore
        }
      }
    },
    [storageMode]
  );

  const clearKey = useCallback(
    (provider) => {
      setKey(provider, "");
    },
    [setKey]
  );

  const clearAll = useCallback(() => {
    setSessionKeys({});
    setPersistedKeys({});
    for (const p of PROVIDERS) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + p);
      } catch {
        // ignore
      }
    }
  }, []);

  const hasKey = useCallback(
    (provider) => {
      return !!getKey(provider);
    },
    [getKey]
  );

  const setStorageMode = useCallback(
    (mode) => {
      setStorageModeState(mode);
      try {
        localStorage.setItem(STORAGE_MODE_KEY, mode);
      } catch {
        // ignore
      }

      // モード切替時にキーを移行
      if (mode === "session") {
        // persistent → session: メモリにコピーし localStorage を消去
        setSessionKeys({ ...persistedKeys });
        for (const p of PROVIDERS) {
          try {
            localStorage.removeItem(STORAGE_PREFIX + p);
          } catch {
            // ignore
          }
        }
        setPersistedKeys({});
      } else {
        // session → persistent: メモリから localStorage へ書込
        for (const [p, v] of Object.entries(sessionKeys)) {
          if (v) {
            try {
              localStorage.setItem(STORAGE_PREFIX + p, encode(v));
            } catch {
              // ignore
            }
          }
        }
        setPersistedKeys({ ...sessionKeys });
        setSessionKeys({});
      }
    },
    [persistedKeys, sessionKeys]
  );

  return {
    getKey,
    setKey,
    clearKey,
    clearAll,
    hasKey,
    storageMode,
    setStorageMode,
    providers: PROVIDERS,
  };
}
