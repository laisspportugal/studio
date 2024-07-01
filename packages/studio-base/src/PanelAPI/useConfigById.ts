// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback } from "react";
import { DeepPartial } from "ts-essentials";

import {
  getTopicToSchemaNameMap,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  getExtensionPanelSettings,
  useExtensionCatalog,
} from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { maybeCast } from "@foxglove/studio-base/util/maybeCast";

/**
 * Like `useConfig`, but for a specific panel id. This generally shouldn't be used by panels
 * directly, but is for use in internal code that's running outside of regular context providers.
 */
export default function useConfigById<Config extends Record<string, unknown>>(
  panelId: string | undefined,
): [Config | undefined, SaveConfig<Config>] {
  const { getCurrentLayoutState, savePanelConfigs } = useCurrentLayoutActions();
  const extensionSettings = useExtensionCatalog(getExtensionPanelSettings);
  const topicToSchemaNameMap = useMessagePipeline(getTopicToSchemaNameMap);

  const configSelector = useCallback(
    (state: DeepPartial<LayoutState>) => {
      if (panelId == undefined) {
        return undefined;
      }
      const stateConfig = maybeCast<Config>(state.selectedLayout?.data?.configById?.[panelId]);
      const topics = Object.keys(stateConfig?.topics ?? {});
      const topicsSettings = _.merge(
        {},
        ...topics.map((topic) => {
          const schemaName = topicToSchemaNameMap[topic];
          if (schemaName == undefined) {
            return {};
          }
          return {
            [topic]: extensionSettings[schemaName]?.defaultConfig,
          };
        }),
        stateConfig?.topics,
      );

      return maybeCast<Config>({ ...stateConfig, topics: topicsSettings });
    },
    [panelId, extensionSettings, topicToSchemaNameMap],
  );

  const config = useCurrentLayoutSelector(configSelector);

  const saveConfig: SaveConfig<Config> = useCallback(
    (newConfig) => {
      if (panelId == undefined) {
        return;
      }

      if (typeof newConfig === "function") {
        // We use a getter here instead of referring directly to the config object
        // so that this callback is stable across config changes.
        const currentConfig = getCurrentLayoutState().selectedLayout?.data?.configById[panelId] as
          | undefined
          | Config;
        if (currentConfig) {
          savePanelConfigs({
            configs: [{ id: panelId, config: newConfig(currentConfig) }],
          });
        }
      } else {
        savePanelConfigs({
          configs: [{ id: panelId, config: newConfig }],
        });
      }
    },
    [getCurrentLayoutState, panelId, savePanelConfigs],
  );

  return [config, saveConfig];
}
