import { describe, expect, it } from "vitest";
import type { ReplayEvent } from "@/engine/replay";
import { spotOf } from "./live";

const ev = (seq: number, type: string, stage: string): ReplayEvent => ({ seq, t: seq * 1000, actor: "candidat", type, payload: { stage } });

describe("spotOf", () => {
  it("l'épreuve affichée est le bâtiment du candidat", () => {
    expect(spotOf([ev(1, "stage.enter", "hub"), ev(2, "stage.leave", "hub"), ev(3, "stage.enter", "sql")], "en_cours")).toBe("sql");
  });
  it("accueil et hub sont la place", () => {
    expect(spotOf([ev(1, "stage.enter", "accueil")], "en_cours")).toBe("hub");
    expect(spotOf([ev(1, "stage.enter", "hub")], "en_cours")).toBe("hub");
  });
  it("le Portail est le Portail", () => {
    expect(spotOf([ev(1, "stage.enter", "portail")], "en_cours")).toBe("portail");
  });
  it("entre deux écrans ou sans événement : pas de pastille", () => {
    expect(spotOf([ev(1, "stage.enter", "sql"), ev(2, "stage.leave", "sql")], "en_cours")).toBeNull();
    expect(spotOf([], "en_cours")).toBeNull();
  });
  it("session non en cours : pas de pastille", () => {
    expect(spotOf([ev(1, "stage.enter", "sql")], "terminee")).toBeNull();
    expect(spotOf([ev(1, "stage.enter", "sql")], "en_attente")).toBeNull();
  });
});
