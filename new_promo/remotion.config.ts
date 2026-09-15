/**
 * Remotion Config — Smart Touch POS Promo Video
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.overrideRspackConfig((config) => {
  const newConfig = enableTailwind(config);

  if (!newConfig.resolve) newConfig.resolve = {};
  if (!newConfig.resolve.extensions) newConfig.resolve.extensions = [];
  newConfig.resolve.extensions.push(".jsx", ".js", ".tsx", ".ts");

  return newConfig;
});
