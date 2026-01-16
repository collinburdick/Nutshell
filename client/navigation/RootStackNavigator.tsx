import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import JoinScreen from "@/screens/JoinScreen";
import SessionScreen from "@/screens/SessionScreen";
import WrapUpScreen from "@/screens/WrapUpScreen";

export type RootStackParamList = {
  Join: undefined;
  Session: { tableId: number; token: string };
  WrapUp: { tableId: number; token: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Join"
        component={JoinScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Session"
        component={SessionScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="WrapUp"
        component={WrapUpScreen}
        options={{
          headerTitle: "Session Wrap-up",
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
