"use client";

import { createTheme } from "@mantine/core";

export const theme = createTheme({
  colors: {
    brand: [
      "#FFF0EB",
      "#FFE0D5",
      "#FFC2B0",
      "#FFA08A",
      "#FA7B5F",
      "#F25634",
      "#D63E20",
      "#BC3218",
      "#9D2916",
      "#7F2415",
    ],
  },
  primaryColor: "brand",
  primaryShade: 6,
  defaultRadius: "md",
  fontFamily: 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
});
