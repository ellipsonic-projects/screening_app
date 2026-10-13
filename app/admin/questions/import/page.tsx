import { QuestionImporter } from '@/components/admin/question-importer';

export const metadata = {
  title: 'Import Questions - Aptitude Screening Portal',
  description: 'Bulk import questions via Excel or CSV',
};

export default function ImportQuestionsPage() {
  return <QuestionImporter />;
}
