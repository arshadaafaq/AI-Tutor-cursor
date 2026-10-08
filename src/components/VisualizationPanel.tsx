import type { VisualizationData } from '../types';

type Props = {
  visualization: VisualizationData | null;
};

export function VisualizationPanel({ visualization }: Props) {
  return (
    <section className="viz-panel" aria-label="Lesson visualization">
      <header className="panel-label">Visual explanation</header>
      {!visualization && (
        <div className="viz-empty">
          <p>When Ava teaches a topic, a simple diagram will appear here.</p>
        </div>
      )}
      {visualization && (
        <div className={`viz-content ${visualization.loading ? 'is-loading' : ''}`}>
          <h2>{visualization.title}</h2>
          {visualization.caption && <p className="viz-caption">{visualization.caption}</p>}
          <div
            className="viz-svg"
            dangerouslySetInnerHTML={{ __html: visualization.svg }}
          />
          {visualization.loading && (
            <p className="viz-refining">
              <span className="viz-spinner inline" /> Refining the diagram…
            </p>
          )}
          {visualization.analogy && !visualization.loading && (
            <p className="viz-analogy">Like this: {visualization.analogy}</p>
          )}
        </div>
      )}
    </section>
  );
}
