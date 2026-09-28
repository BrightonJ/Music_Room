import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Go back to the previous screen, or to `fallback` when there is none
 * (app reloaded on this screen, opened from a deep link...). `router.back()` alone does nothing then.
 */
export function goBack(router: Router, fallback: Href = '/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
