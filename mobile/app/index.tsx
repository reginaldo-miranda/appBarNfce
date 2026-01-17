import React from "react";
import { Redirect } from "expo-router";

export default function Index() {
  // Redireciona para login original
  return <Redirect href="/login" />;
}
