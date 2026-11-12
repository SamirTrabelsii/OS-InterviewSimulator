/** Réponse mal formée : refusée sans compter comme une tentative. */
export class MalformedAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedAnswerError";
  }
}
