/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Text } from 'ink';
import { type Config, getErrorMessage } from '@google/gemini-cli-core';
import { SettingScope } from '../../config/settings.js';
import {
  PROVIDER_ENVIRONMENT_VARIABLES,
  setProviderEnvironmentVariable,
} from '../../config/providerEnvironment.js';
import { theme } from '../semantic-colors.js';
import {
  BaseSettingsDialog,
  type SettingsDialogItem,
} from './shared/BaseSettingsDialog.js';

interface ProviderConfigDialogProps {
  config: Config;
  onClose: () => void;
  availableTerminalHeight?: number;
}

function getInitialValues(): Record<string, string> {
  return Object.fromEntries(
    PROVIDER_ENVIRONMENT_VARIABLES.map(({ name }) => [
      name,
      process.env[name] ?? '',
    ]),
  );
}

function maskSecret(value: string): string {
  if (!value) {
    return '(not set)';
  }
  return '*'.repeat(Math.min(Math.max(value.length, 8), 16));
}

export function ProviderConfigDialog({
  config,
  onClose,
  availableTerminalHeight,
}: ProviderConfigDialogProps): React.JSX.Element {
  const [values, setValues] =
    useState<Record<string, string>>(getInitialValues);
  const [status, setStatus] = useState(
    'Values are saved to the user environment and applied to this session.',
  );
  const [statusIsError, setStatusIsError] = useState(false);

  const items: SettingsDialogItem[] = useMemo(
    () =>
      PROVIDER_ENVIRONMENT_VARIABLES.map((definition) => {
        const value = values[definition.name] ?? '';
        return {
          key: definition.name,
          label: `${definition.label} (${definition.name})`,
          description: definition.description,
          type: 'string',
          displayValue: definition.secret
            ? maskSecret(value)
            : value || '(not set)',
          rawValue: value,
          editValue: value,
          isGreyedOut: !value,
          maskValue: definition.secret,
        };
      }),
    [values],
  );

  const saveValue = useCallback(
    async (name: string, value: string | undefined) => {
      setStatusIsError(false);
      setStatus(`Saving ${name}...`);

      try {
        await setProviderEnvironmentVariable(name, value);
        setValues((current) => ({
          ...current,
          [name]: value?.trim() ?? '',
        }));

        try {
          const provider = await config.refreshModelProviderFromEnvironment();
          setStatus(
            `Saved ${name}. Active provider: ${provider.displayName ?? provider.profile ?? provider.provider}` +
              (provider.model ? `, model: ${provider.model}` : ''),
          );
        } catch (error) {
          setStatusIsError(true);
          setStatus(
            `Saved ${name}, but the provider is not ready: ${getErrorMessage(error)}`,
          );
        }
      } catch (error) {
        setStatusIsError(true);
        setStatus(`Could not save ${name}: ${getErrorMessage(error)}`);
      }
    },
    [config],
  );

  const handleEditCommit = useCallback(
    (key: string, value: string) => {
      void saveValue(key, value);
    },
    [saveValue],
  );

  const handleClear = useCallback(
    (key: string) => {
      void saveValue(key, undefined);
    },
    [saveValue],
  );

  return (
    <BaseSettingsDialog
      title="Provider Environment"
      borderColor={statusIsError ? theme.status.warning : undefined}
      searchEnabled={false}
      items={items}
      showScopeSelector={false}
      selectedScope={SettingScope.User}
      maxItemsToShow={7}
      availableHeight={availableTerminalHeight}
      maxLabelWidth={34}
      onItemToggle={() => {}}
      onEditCommit={handleEditCommit}
      onItemClear={handleClear}
      onClose={onClose}
      footer={{
        content: (
          <Text
            color={statusIsError ? theme.status.warning : theme.text.secondary}
          >
            {status}
          </Text>
        ),
        height: 2,
      }}
    />
  );
}
