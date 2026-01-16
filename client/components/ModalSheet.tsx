import React from "react";
import { Modal, Pressable, StyleSheet, View, ViewProps } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: ViewProps["style"];
}

export function ModalSheet({ visible, onClose, children, contentStyle }: ModalSheetProps) {
  const { tokens } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: tokens.colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.content,
            {
              backgroundColor: tokens.colors.surface,
              borderRadius: tokens.radii.xl,
            },
            contentStyle,
          ]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: tokens.colors.borderSubtle }]} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    padding: 16,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
});
