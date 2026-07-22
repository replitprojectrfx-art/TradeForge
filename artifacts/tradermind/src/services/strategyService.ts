import { db, Strategy, Phase, Step, Rule } from '../db/database';

export const strategyService = {
  async getAllStrategies() {
    return db.strategies.orderBy('createdAt').reverse().toArray();
  },

  async getStrategyById(id: string) {
    return db.strategies.get(id);
  },

  async createStrategy(data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const strategy: Strategy = { ...data, id, createdAt: now, updatedAt: now };
    await db.strategies.add(strategy);
    return strategy;
  },

  async updateStrategy(id: string, data: Partial<Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.strategies.update(id, { ...data, updatedAt: Date.now() });
    return db.strategies.get(id);
  },

  async deleteStrategy(id: string) {
    await db.transaction('rw', db.strategies, db.phases, db.steps, db.rules, async () => {
      const phases = await db.phases.where('strategyId').equals(id).toArray();
      const phaseIds = phases.map(p => p.id);
      const stepIds = (await db.steps.where('phaseId').anyOf(phaseIds).toArray()).map(s => s.id);
      await db.rules.where('stepId').anyOf(stepIds).delete();
      await db.steps.where('phaseId').anyOf(phaseIds).delete();
      await db.phases.where('strategyId').equals(id).delete();
      await db.strategies.delete(id);
    });
  },

  async getPhasesByStrategyId(strategyId: string) {
    return db.phases.where('strategyId').equals(strategyId).sortBy('order');
  },

  async createPhase(data: Omit<Phase, 'id'>) {
    const id = crypto.randomUUID();
    const phase: Phase = { ...data, id };
    await db.phases.add(phase);
    return phase;
  },

  async updatePhase(id: string, data: Partial<Phase>) {
    await db.phases.update(id, data);
    return db.phases.get(id);
  },

  async deletePhase(id: string) {
    await db.transaction('rw', db.phases, db.steps, db.rules, async () => {
      const stepIds = (await db.steps.where('phaseId').equals(id).toArray()).map(s => s.id);
      await db.rules.where('stepId').anyOf(stepIds).delete();
      await db.steps.where('phaseId').equals(id).delete();
      await db.phases.delete(id);
    });
  },

  async duplicatePhase(phaseId: string): Promise<Phase> {
    const phase = await db.phases.get(phaseId);
    if (!phase) throw new Error('Phase not found');
    const existingPhases = await db.phases.where('strategyId').equals(phase.strategyId).toArray();
    const newPhase = await this.createPhase({
      strategyId: phase.strategyId,
      name: phase.name + ' (Copy)',
      description: phase.description,
      order: existingPhases.length,
    });
    const steps = await db.steps.where('phaseId').equals(phaseId).sortBy('order');
    for (const step of steps) {
      const newStep = await this.createStep({
        phaseId: newPhase.id,
        name: step.name,
        description: step.description,
        type: step.type,
        required: step.required,
        order: step.order,
        options: step.options,
        hint: step.hint,
      });
      const rules = await db.rules.where('stepId').equals(step.id).sortBy('order');
      for (const rule of rules) {
        await this.createRule({
          stepId: newStep.id,
          title: rule.title,
          description: rule.description,
          type: rule.type,
          required: rule.required,
          order: rule.order,
          options: rule.options,
        });
      }
    }
    return newPhase;
  },

  async getStepsByPhaseId(phaseId: string) {
    return db.steps.where('phaseId').equals(phaseId).sortBy('order');
  },

  async createStep(data: Omit<Step, 'id'>) {
    const id = crypto.randomUUID();
    const step: Step = { ...data, id };
    await db.steps.add(step);
    return step;
  },

  async updateStep(id: string, data: Partial<Step>) {
    await db.steps.update(id, data);
    return db.steps.get(id);
  },

  async deleteStep(id: string) {
    await db.transaction('rw', db.steps, db.rules, async () => {
      await db.rules.where('stepId').equals(id).delete();
      await db.steps.delete(id);
    });
  },

  async duplicateStep(stepId: string): Promise<Step> {
    const step = await db.steps.get(stepId);
    if (!step) throw new Error('Step not found');
    const existingSteps = await db.steps.where('phaseId').equals(step.phaseId).toArray();
    const newStep = await this.createStep({
      phaseId: step.phaseId,
      name: step.name + ' (Copy)',
      description: step.description,
      type: step.type,
      required: step.required,
      order: existingSteps.length,
      options: step.options,
      hint: step.hint,
    });
    const rules = await db.rules.where('stepId').equals(stepId).sortBy('order');
    for (const rule of rules) {
      await this.createRule({
        stepId: newStep.id,
        title: rule.title,
        description: rule.description,
        type: rule.type,
        required: rule.required,
        order: rule.order,
        options: rule.options,
      });
    }
    return newStep;
  },

  async reorderPhases(phases: Phase[]) {
    await db.transaction('rw', db.phases, async () => {
      for (const phase of phases) {
        await db.phases.update(phase.id, { order: phase.order });
      }
    });
  },

  async reorderSteps(steps: Step[]) {
    await db.transaction('rw', db.steps, async () => {
      for (const step of steps) {
        await db.steps.update(step.id, { order: step.order, phaseId: step.phaseId });
      }
    });
  },

  // RULES
  async getRulesByStepId(stepId: string) {
    return db.rules.where('stepId').equals(stepId).sortBy('order');
  },

  async createRule(data: Omit<Rule, 'id'>): Promise<Rule> {
    const id = crypto.randomUUID();
    const rule: Rule = { ...data, id };
    await db.rules.add(rule);
    return rule;
  },

  async updateRule(id: string, data: Partial<Rule>) {
    await db.rules.update(id, data);
    return db.rules.get(id);
  },

  async deleteRule(id: string) {
    await db.rules.delete(id);
  },

  async reorderRules(rules: Rule[]) {
    await db.transaction('rw', db.rules, async () => {
      for (const r of rules) {
        await db.rules.update(r.id, { order: r.order });
      }
    });
  }
};