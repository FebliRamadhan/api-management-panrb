import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'auth',
  initialState: { username: null },
  reducers: {
    setUser: (s, a) => { s.username = a.payload; },
    clearUser: (s) => { s.username = null; },
  },
});

export const { setUser, clearUser } = slice.actions;
export default slice.reducer;
