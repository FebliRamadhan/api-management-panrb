import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE } from '../../lib/apiBase';

export const themeApi = createApi({
  reducerPath: 'themeApi',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE, credentials: 'same-origin' }),
  tagTypes: ['Theme'],
  endpoints: (b) => ({
    getTheme: b.query({
      query: (portal) => `/theme/${portal}`,
      providesTags: (_r, _e, portal) => [{ type: 'Theme', id: portal }],
    }),
    saveTheme: b.mutation({
      query: ({ portal, body }) => {
        const fd = new URLSearchParams();
        Object.entries(body).forEach(([k, v]) => v !== undefined && v !== null && fd.append(k, v));
        return {
          url: `/theme/${portal}`,
          method: 'POST',
          body: fd.toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
      },
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Theme', id: portal }],
    }),
    saveRawTheme: b.mutation({
      query: ({ portal, content }) => ({
        url: `/theme/${portal}/raw`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Theme', id: portal }],
    }),
  }),
});

export const {
  useGetThemeQuery,
  useSaveThemeMutation,
  useSaveRawThemeMutation,
} = themeApi;
