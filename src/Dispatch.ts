/**
 * The purpose of this file is to leverage vite's automatic chunk splitting.
 * The bulk of the libs (e.g. starknet.js) are not needed on the homepage,
 * and not loading them there makes that page super-fast, and it doesn't slow the builder significantly.
 * Three.js is also split in a similar manner.
 */

import * as StoreModule from './store/Store';
import BuilderVue from './components/builder/Builder.vue';
import AdminVue from './components/Admin.vue';
import DebugVue from './components/debug/Debug.vue';
import ShareVue from './components/builder/share/Share.vue';
import GalleryVue from './components/builder/gallery/Gallery.vue';
import * as walletModule from '@/chain/Wallet';

export const Builder = BuilderVue;
export const Admin = AdminVue;
export const Debug = DebugVue;
export const Share = ShareVue;
export const Gallery = GalleryVue;
export const Store = StoreModule;
export const Wallet = walletModule;

// Load VueX store - this is only relied upon by modules loaded here.
import { app } from './main.js';
app.use(StoreModule.store);
StoreModule.setLoaded();
