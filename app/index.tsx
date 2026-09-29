import { Redirect } from "expo-router";

/**
 * Root `/` route. AuthGuard normally sends users to `/(tabs)`, but after e.g.
 * swiping back from `/import` the stack can land here — an empty screen with a
 * bare "index" header. Always redirect so users never see a blank page.
 */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
