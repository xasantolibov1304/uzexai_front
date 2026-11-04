import ChatPanel from "../components/ChatPanel";
import { PageHead } from "../components/ui";
import { useLang } from "../i18n/LangContext";

export default function ChatPage() {
  const { t } = useLang();
  return (
    <div className="page" style={{ paddingTop: 20, paddingBottom: 32 }}>
      <div className="container">
        <PageHead title={t.nav.chat} sub={t.chat.emptySub} />
        <ChatPanel variant="page" />
      </div>
    </div>
  );
}
