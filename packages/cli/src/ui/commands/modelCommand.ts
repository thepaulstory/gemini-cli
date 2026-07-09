/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getAllModelProviderProfiles,
  getModelProviderProfile,
  ModelSlashCommandEvent,
  logModelSlashCommand,
} from '@google/gemini-cli-core';
import {
  type CommandContext,
  CommandKind,
  type SlashCommand,
} from './types.js';
import { MessageType } from '../types.js';
import { createElement } from 'react';
import { ProviderConfigDialog } from '../components/ProviderConfigDialog.js';

const setModelCommand: SlashCommand = {
  name: 'set',
  description:
    'Set the model to use. Usage: /model set <model-name> [--persist]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context: CommandContext, args: string) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Usage: /model set <model-name> [--persist]',
      });
      return;
    }

    const modelName = parts[0];
    const persist = parts.includes('--persist');

    if (context.services.agentContext?.config) {
      context.services.agentContext.config.setModel(modelName, !persist);
      const event = new ModelSlashCommandEvent(modelName);
      logModelSlashCommand(context.services.agentContext.config, event);

      context.ui.addItem({
        type: MessageType.INFO,
        text: `Model set to ${modelName}${persist ? ' (persisted)' : ''}`,
      });
    }
  },
};

const manageModelCommand: SlashCommand = {
  name: 'manage',
  description: 'Opens a dialog to configure the model',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext) => {
    if (context.services.agentContext?.config) {
      await context.services.agentContext.config.refreshUserQuota();
    }
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};

const configureProviderEnvironmentCommand: SlashCommand = {
  name: 'environment',
  altNames: ['env', 'configure'],
  description: 'Edit persistent provider environment variables',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context: CommandContext) => {
    const config = context.services.agentContext?.config;
    if (!config) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Provider configuration is not available yet.',
      });
      return;
    }

    return {
      type: 'custom_dialog',
      component: createElement(ProviderConfigDialog, {
        config,
        onClose: context.ui.removeComponent,
      }),
    };
  },
};

const listProvidersCommand: SlashCommand = {
  name: 'providers',
  description: 'List configured model provider profiles',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext) => {
    const profiles = getAllModelProviderProfiles()
      .map((profile) => {
        const modelHint = profile.defaultModel
          ? ` default=${profile.defaultModel}`
          : '';
        const keyHint = profile.apiKeyEnvVars?.length
          ? ` key=${profile.apiKeyEnvVars.join('|')}`
          : '';
        return `${profile.id}: ${profile.displayName}${modelHint}${keyHint}`;
      })
      .join('\n');

    context.ui.addItem({
      type: MessageType.INFO,
      text: profiles,
    });
  },
};

const providerCommand: SlashCommand = {
  name: 'provider',
  description:
    'Switch provider profile. Usage: /model provider <profile> [model-name] [--persist]',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context: CommandContext, args: string) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Usage: /model provider <profile> [model-name] [--persist]',
      });
      return;
    }

    const persist = parts.includes('--persist');
    const value = parts.find((part) => part !== '--persist') ?? '';
    const explicitModel = parts
      .filter((part) => part !== '--persist' && part !== value)
      .join(' ');
    const [profileId, inlineModel] = value.split(':');
    const modelName = explicitModel || inlineModel;
    const profile = getModelProviderProfile(profileId);

    if (!profile) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: `Unknown provider profile: ${profileId}. Run /model providers to list profiles.`,
      });
      return;
    }

    const config = context.services.agentContext?.config;
    if (!config) {
      return;
    }

    try {
      await config.setModelProviderProfile(profile.id, modelName, !persist);
      const selectedModel =
        modelName || profile.defaultModel || profile.models[0]?.id;
      if (selectedModel) {
        const event = new ModelSlashCommandEvent(selectedModel);
        logModelSlashCommand(config, event);
      }

      const providerConfig = config.getModelProviderConfig();
      const keyHint = providerConfig.apiKeyEnv
        ? ` using ${providerConfig.apiKeyEnv}`
        : '';
      context.ui.addItem({
        type: MessageType.INFO,
        text:
          `Provider set to ${profile.displayName}` +
          `${selectedModel ? ` with model ${selectedModel}` : ''}` +
          `${persist ? ' (model persisted)' : ''}` +
          keyHint,
      });
    } catch (e) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

const profileCommand: SlashCommand = {
  ...providerCommand,
  name: 'profile',
  description:
    'Alias for /model provider. Usage: /model profile <profile> [model-name] [--persist]',
};

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Manage model configuration',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [
    manageModelCommand,
    configureProviderEnvironmentCommand,
    setModelCommand,
    listProvidersCommand,
    providerCommand,
    profileCommand,
  ],
  action: async (context: CommandContext, args: string) =>
    manageModelCommand.action!(context, args),
};
