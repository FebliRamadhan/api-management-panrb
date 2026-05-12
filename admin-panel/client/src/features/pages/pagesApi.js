import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE } from '../../lib/apiBase';

export const pagesApi = createApi({
  reducerPath: 'pagesApi',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE, credentials: 'same-origin' }),
  tagTypes: ['Pages', 'Menu'],
  endpoints: (b) => ({
    listPages: b.query({
      query: (portal) => `/pages/${portal}`,
      providesTags: (_r, _e, p) => [{ type: 'Pages', id: p }],
    }),
    getPage: b.query({
      query: ({ portal, slug }) => `/pages/${portal}/${slug}`,
      providesTags: (_r, _e, { portal, slug }) => [{ type: 'Pages', id: `${portal}/${slug}` }],
    }),
    savePage: b.mutation({
      query: ({ portal, slug, title, content }) => ({
        url: `/pages/${portal}/${slug}`,
        method: 'PUT',
        body: { title, content },
      }),
      invalidatesTags: (_r, _e, { portal, slug }) => [
        { type: 'Pages', id: portal },
        { type: 'Pages', id: `${portal}/${slug}` },
      ],
    }),
    deletePage: b.mutation({
      query: ({ portal, slug }) => ({
        url: `/pages/${portal}/${slug}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Pages', id: portal }],
    }),
    getMenu: b.query({
      query: (portal) => `/menu/${portal}`,
      providesTags: (_r, _e, p) => [{ type: 'Menu', id: p }],
    }),
    saveMenu: b.mutation({
      query: ({ portal, items }) => ({
        url: `/menu/${portal}`,
        method: 'PUT',
        body: { items },
      }),
      invalidatesTags: (_r, _e, { portal }) => [{ type: 'Menu', id: portal }],
    }),
  }),
});

export const {
  useListPagesQuery,
  useGetPageQuery,
  useSavePageMutation,
  useDeletePageMutation,
  useGetMenuQuery,
  useSaveMenuMutation,
} = pagesApi;
