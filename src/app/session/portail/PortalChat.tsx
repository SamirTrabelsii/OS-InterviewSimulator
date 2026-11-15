"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_MAX_LEN } from "@/engine/portal";
import type { PortalView } from "@/engine/portal";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import { trackEvent } from "../EventTracker";
import { reasonText, type usePortal } from "./usePortal";

type Send = ReturnType<typeof usePortal>["send"];

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Chat de secours entre binômes (l'appel reste le moyen principal). Les
 * messages sont journalisés côté serveur : le recruteur les retrouve au replay.
 * Avec `send` absent, la liste est en lecture seule (observation recruteur).
 */
export function PortalChat({ chat, send, partnerName }: { chat: NonNullable<PortalView["chat"]>; send?: Send; partnerName?: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.length]);

  async function submit() {
    const value = text.trim();
    if (!value || !send || pending) return;
    setPending(true);
    setError(null);
    const a = await send("chat:send", { text: value });
    setPending(false);
    if (a.ok) {
      setText("");
      trackEvent("chat.compose", { chars: value.length });
    } else {
      setError(a.reason === "trop-tot" ? "Doucement : un message par seconde." : reasonText(a));
    }
  }

  return (
    <PixelPanel tone="violet" title={send ? "Chat de secours" : "Chat du binôme"}>
      {send && (
        <p className="px-muted" style={{ marginTop: 0 }}>
          Si l&apos;appel ne fonctionne pas, écrivez ici à {partnerName ?? "votre binôme"}. Les messages sont enregistrés pour le recruteur.
        </p>
      )}
      <ul ref={list} role="log" aria-live="polite" aria-label="Messages du binôme" tabIndex={0} className="px-chat">
        {chat.length === 0 && <li className="px-muted">Aucun message pour l&apos;instant.</li>}
        {chat.map((m) => (
          <li key={m.id} data-mine={m.mine}>
            <span className="px-chat-who">
              {m.mine ? "Vous" : m.name} · {time(m.at)}
            </span>
            <span className="px-chat-text">{m.text}</span>
          </li>
        ))}
      </ul>
      {send && (
        <form
          className="px-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="px-sr" htmlFor="px-chat-input">
            Votre message
          </label>
          <input
            id="px-chat-input"
            className="px-chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CHAT_MAX_LEN}
            autoComplete="off"
            placeholder="Votre message…"
          />
          <PixelButton type="submit" variant="secondary" disabled={pending || text.trim() === ""}>
            Envoyer
          </PixelButton>
        </form>
      )}
      {error && (
        <PixelStatus tone="warn">
          <p>{error}</p>
        </PixelStatus>
      )}
    </PixelPanel>
  );
}
