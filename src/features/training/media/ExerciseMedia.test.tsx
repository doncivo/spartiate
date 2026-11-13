import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../../domain/training';
import { exerciseImage } from '../../../domain/training/media';
import exercisesJson from '../../../../content/exercises/exercises.json';
import ExerciseMedia from './ExerciseMedia';
import { mediaAttribution, mediaUrl } from './exerciseMediaFiles';

// I6-07 (D-235) : image locale du catalogue sous la fiche, attribution visible, repli sans icône cassée, aucune adresse réseau.

function exercise(id: string, media: Exercise['media']): Exercise {
  return {
    origin: 'embedded',
    id,
    nameFr: 'Développé couché à la barre',
    aliasesEn: [],
    muscles: [{ id: 'chest', weight: 1 }],
    equipment: ['barbell'],
    pattern: 'push-horizontal',
    kind: 'compound',
    metric: 'load-reps',
    bodyweightFraction: null,
    defaultRepRange: [6, 10],
    defaultRestSec: 150,
    instructions: { setup: '', execution: '', mistakes: [] },
    media,
    strengthStandardKey: null,
    schemaVersion: 1,
  };
}

const BENCH = exercise('bench-press-barbell', { images: ['bench-press-barbell.png'], video: null, license: 'CC-BY-SA-4.0', source: 'everkinetic:dist/png/0042-tension.png' });

describe('ExerciseMedia', () => {
  it('affiche l’image locale avec un texte alternatif et l’attribution dessous (auteur, licence, adresse de la licence)', () => {
    render(<ExerciseMedia exercise={BENCH} />);
    const img = screen.getByRole('img', { name: 'Illustration : Développé couché à la barre' });
    expect(img.getAttribute('src')).toMatch(/bench-press-barbell.*\.png/);
    expect(img.getAttribute('src')).not.toMatch(/^https?:/);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByText('Illustration : Everkinetic (Greg Priday et contributeurs), CC BY-SA 4.0, creativecommons.org/licenses/by-sa/4.0')).toBeInTheDocument();
  });

  it('sans média : ne rend rien (aucune icône cassée, D-71)', () => {
    const { container } = render(<ExerciseMedia exercise={exercise('plank', null)} />);
    expect(container.innerHTML).toBe('');
  });

  it('image illisible ou absente du paquet : « Illustration indisponible », visible, sans image', () => {
    render(<ExerciseMedia exercise={BENCH} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Illustration indisponible')).toBeInTheDocument();
    render(<ExerciseMedia exercise={exercise('x', { images: ['inconnu.png'], video: null, license: 'CC-BY-SA-4.0', source: 'everkinetic:x.png' })} />);
    expect(screen.getAllByText('Illustration indisponible')).toHaveLength(2);
  });

  it('chaque média du catalogue se résout en une adresse locale et chaque source a son attribution', () => {
    let n = 0;
    for (const x of exercisesJson.exercises) {
      const image = exerciseImage(x.media.license !== null && x.media.source !== null ? { images: x.media.images, video: x.media.video, license: x.media.license, source: x.media.source } : null);
      if (!image) continue;
      n += 1;
      expect(mediaUrl(image.file), x.id).toMatch(/\.png/);
      expect(mediaAttribution(image.sourceId), x.id).not.toBeNull();
    }
    expect(n).toBe(87);
    expect(mediaAttribution('inconnue')).toBeNull();
    expect(mediaUrl('inconnu.png')).toBeNull();
  });

  it('le code de chargement ne contient aucune adresse réseau (CSP inchangée)', () => {
    for (const file of ['ExerciseMedia.tsx', 'exerciseMediaFiles.ts']) {
      expect(readFileSync(resolve(__dirname, file), 'utf8'), file).not.toMatch(/https?:\/\//);
    }
    const csp = JSON.stringify((JSON.parse(readFileSync(resolve(__dirname, '../../../../src-tauri/tauri.conf.json'), 'utf8')) as { app: { security: { csp: Record<string, string> } } }).app.security.csp);
    expect(csp).toContain(`"img-src":"'self' data: asset: http://asset.localhost"`);
  });
});
