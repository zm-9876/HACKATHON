import { configureStore } from "@reduxjs/toolkit";
import bankingReducer from "./bankingSlice";

export const store = configureStore({
  reducer: { banking: bankingReducer },
});
