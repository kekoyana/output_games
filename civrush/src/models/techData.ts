import type { TechNode, TechId, TechTree } from './types';
import { t } from '../i18n';

export function createTechTree(): TechTree {
  const techNodes: TechNode[] = [
    // Ancient
    { id: 'agriculture', name: t('techAgriculture'), era: 'ancient', cost: 10, description: t('descAgriculture'), requires: [] },
    { id: 'bronze', name: t('techBronze'), era: 'ancient', cost: 10, description: t('descBronze'), requires: [] },
    { id: 'archery', name: t('techArchery'), era: 'ancient', cost: 15, description: t('descArchery'), requires: ['bronze'] },
    { id: 'calendar', name: t('techCalendar'), era: 'ancient', cost: 10, description: t('descCalendar'), requires: [] },
    // Medieval
    { id: 'fortification', name: t('techFortification'), era: 'medieval', cost: 25, description: t('descFortification'), requires: ['agriculture'] },
    { id: 'iron', name: t('techIron'), era: 'medieval', cost: 25, description: t('descIron'), requires: ['bronze'] },
    { id: 'mathematics', name: t('techMathematics'), era: 'medieval', cost: 30, description: t('descMathematics'), requires: ['archery'] },
    { id: 'printing', name: t('techPrinting'), era: 'medieval', cost: 25, description: t('descPrinting'), requires: ['calendar'] },
    // Modern
    { id: 'industrialization', name: t('techIndustrialization'), era: 'modern', cost: 50, description: t('descIndustrialization'), requires: ['iron', 'fortification'] },
    { id: 'railroad', name: t('techRailroad'), era: 'modern', cost: 45, description: t('descRailroad'), requires: ['industrialization'] },
    { id: 'mechanization', name: t('techMechanization'), era: 'modern', cost: 50, description: t('descMechanization'), requires: ['mathematics'] },
    { id: 'electricity', name: t('techElectricity'), era: 'modern', cost: 55, description: t('descElectricity'), requires: ['printing', 'mathematics'] },
    // Atomic
    { id: 'nuclear_power', name: t('techNuclearPower'), era: 'atomic', cost: 80, description: t('descNuclearPower'), requires: ['industrialization', 'electricity'] },
    { id: 'computers', name: t('techComputers'), era: 'atomic', cost: 80, description: t('descComputers'), requires: ['electricity', 'mechanization'] },
    { id: 'space_program', name: t('techSpaceProgram'), era: 'atomic', cost: 120, description: t('descSpaceProgram'), requires: ['nuclear_power', 'computers'] },
  ];

  const nodes = new Map<TechId, TechNode>();
  for (const node of techNodes) {
    nodes.set(node.id, node);
  }
  return { nodes };
}

export function getEraOrder(era: string): number {
  if (era === 'ancient') return 0;
  if (era === 'medieval') return 1;
  if (era === 'modern') return 2;
  return 3;
}
