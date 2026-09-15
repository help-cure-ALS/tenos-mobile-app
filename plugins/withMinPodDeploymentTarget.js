/**
 * Config plugin: raise all Pods targets below iOS 15.0.
 *
 * Xcode 27 hard-errors on IPHONEOS_DEPLOYMENT_TARGET < 15.0, but some
 * third-party podspecs (react-native-svg 12.4, ReachabilitySwift 12.0
 * via expo-updates, lottie 13.x, async-storage 13.4) still declare
 * older targets — CocoaPods copies those values onto their resource
 * bundle / privacy manifest sub-targets, which react_native_post_install
 * does not touch (see expo/expo#47537).
 *
 * ios/ is generated (prebuild/CNG), so the fix must live here instead
 * of in ios/Podfile: this plugin injects the canonical post_install
 * snippet into the generated Podfile on every prebuild. Functionally a
 * no-op for the app itself (deployment target 16.4) — it only lifts
 * the declared floor of the pods.
 */
const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MIN_IOS = '15.0';

const SNIPPET = `    # Xcode 27 rejects deployment targets below ${MIN_IOS}; some pods
    # (and their resource-bundle targets) still declare 12.x/13.x.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS.split('.')[0]}.0
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end`;

module.exports = function withMinPodDeploymentTarget(config) {
    return withPodfile(config, (config) => {
        config.modResults.contents = mergeContents({
            src: config.modResults.contents,
            newSrc: SNIPPET,
            anchor: /post_install do \|installer\|/,
            offset: 1,
            tag: 'min-pod-deployment-target',
            comment: '#',
        }).contents;
        return config;
    });
};
