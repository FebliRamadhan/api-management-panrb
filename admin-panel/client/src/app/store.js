import { configureStore } from '@reduxjs/toolkit';
import { authApi } from '../features/auth/authApi';
import { themeApi } from '../features/theme/themeApi';
import { imagesApi } from '../features/images/imagesApi';
import { systemApi } from '../features/system/systemApi';
import { pagesApi } from '../features/pages/pagesApi';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import uiReducer from '../features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    ui: uiReducer,
    [authApi.reducerPath]: authApi.reducer,
    [themeApi.reducerPath]: themeApi.reducer,
    [imagesApi.reducerPath]: imagesApi.reducer,
    [systemApi.reducerPath]: systemApi.reducer,
    [pagesApi.reducerPath]: pagesApi.reducer,
  },
  middleware: (gdm) =>
    gdm()
      .concat(authApi.middleware)
      .concat(themeApi.middleware)
      .concat(imagesApi.middleware)
      .concat(systemApi.middleware)
      .concat(pagesApi.middleware),
});
