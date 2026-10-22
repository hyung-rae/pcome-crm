import { Badge, Container, Paper, Stack, Text, Title } from "@mantine/core";

export default function Home() {
  return (
    <Container size="sm" py={80}>
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md" align="flex-start">
          <Badge variant="light">PCOME CRM</Badge>
          <Title order={1}>프로젝트를 시작할 준비가 되었습니다.</Title>
          <Text c="dimmed">
            Next.js, TypeScript, Mantine 기반의 개발 환경입니다.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
