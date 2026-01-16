import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import JoinScreen from "@/screens/JoinScreen";
import SessionScreen from "@/screens/SessionScreen";
import WrapUpScreen from "@/screens/WrapUpScreen";
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import EventDetailScreen from "@/screens/EventDetailScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import LiveMonitoringScreen from "@/screens/LiveMonitoringScreen";

export type RootStackParamList = {
  Join: undefined;
  Session: { tableId: number; token: string };
  WrapUp: { tableId: number; token: string };
  AdminLogin: undefined;
  AdminDashboard: undefined;
  EventDetail: { eventId: number };
  SessionDetail: { sessionId: number };
  LiveMonitoring: undefined;
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
      <Stack.Screen
        name="AdminLogin"
        component={AdminLoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{
          headerTitle: "Event Details",
        }}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{
          headerTitle: "Session Details",
        }}
      />
      <Stack.Screen
        name="LiveMonitoring"
        component={LiveMonitoringScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
