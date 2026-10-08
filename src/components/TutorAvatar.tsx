import type { TutorState } from '../types';

type Props = {
  state: TutorState;
};

const STATE_LABEL: Record<TutorState, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting…',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Something went wrong',
};

export function TutorAvatar({ state }: Props) {
  return (
    <div className={`avatar-stage state-${state}`} aria-live="polite">
      <div className="avatar-rings" aria-hidden="true">
        <span className="ring ring-a" />
        <span className="ring ring-b" />
        <span className="ring ring-c" />
      </div>

      <div className="avatar-figure" role="img" aria-label={`Ava the tutor — ${STATE_LABEL[state]}`}>
        <svg viewBox="0 0 280 320" className="avatar-svg">
          <defs>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F6D4B8" />
              <stop offset="100%" stopColor="#E8B992" />
            </linearGradient>
            <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2F4A5C" />
              <stop offset="100%" stopColor="#1A3344" />
            </linearGradient>
            <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4FA58F" />
              <stop offset="100%" stopColor="#3D8B74" />
            </linearGradient>
          </defs>

          {/* shoulders */}
          <path
            d="M40 300 C70 230, 210 230, 240 300 Z"
            fill="url(#shirt)"
          />
          <circle cx="140" cy="128" r="72" fill="url(#skin)" />

          {/* hair */}
          <path
            d="M72 120 C70 48, 210 48, 208 120 C200 78, 80 78, 72 120 Z"
            fill="url(#hair)"
          />
          <path
            d="M68 130 C55 170, 62 210, 78 220 C86 180, 78 150, 88 128 Z"
            fill="url(#hair)"
          />
          <path
            d="M212 130 C225 170, 218 210, 202 220 C194 180, 202 150, 192 128 Z"
            fill="url(#hair)"
          />

          {/* glasses */}
          <circle cx="112" cy="128" r="22" fill="none" stroke="#1A3344" strokeWidth="4" />
          <circle cx="168" cy="128" r="22" fill="none" stroke="#1A3344" strokeWidth="4" />
          <path d="M134 128 H146" stroke="#1A3344" strokeWidth="4" strokeLinecap="round" />
          <path d="M90 124 H98" stroke="#1A3344" strokeWidth="3" strokeLinecap="round" />
          <path d="M182 124 H190" stroke="#1A3344" strokeWidth="3" strokeLinecap="round" />

          {/* eyes */}
          <g className="eyes">
            <ellipse className="eye-l" cx="112" cy="128" rx="5" ry="6" fill="#1A3344" />
            <ellipse className="eye-r" cx="168" cy="128" rx="5" ry="6" fill="#1A3344" />
          </g>

          {/* cheeks */}
          <circle cx="92" cy="148" r="8" fill="#F2A48A" opacity="0.45" />
          <circle cx="188" cy="148" r="8" fill="#F2A48A" opacity="0.45" />

          {/* mouth */}
          <path
            className="mouth"
            d="M124 162 Q140 174 156 162"
            fill="none"
            stroke="#C56B55"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* thinking dots */}
          <g className="think-dots" opacity="0">
            <circle cx="210" cy="70" r="5" fill="#5BA4CF" />
            <circle cx="228" cy="58" r="7" fill="#5BA4CF" />
            <circle cx="248" cy="48" r="9" fill="#5BA4CF" />
          </g>
        </svg>
      </div>

      <p className="avatar-status">{STATE_LABEL[state]}</p>
    </div>
  );
}
