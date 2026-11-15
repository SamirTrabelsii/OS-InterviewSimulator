/** Écran d'attente des épreuves (même fond que l'épreuve, pas d'éclair blanc). */
export function StageLoading() {
  return (
    <div className="px-stage">
        <p className="px-muted" role="status">
          Chargement…
        </p>
    </div>
  );
}
