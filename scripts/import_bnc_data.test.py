import unittest
from pathlib import Path

from import_bnc_data import load_canonical


class ImportBncDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_canonical(Path(__file__).parents[1] / ".private" / "bnc")

    def test_combines_all_three_sources_without_duplicate_references(self):
        projects = self.data["projects"]
        refs = [project["ref"] for project in projects]
        self.assertEqual(len(projects), 4536)
        self.assertEqual(len(refs), len(set(refs)))
        self.assertEqual(self.data["metadata"]["rawRows"], 4568)
        self.assertEqual(self.data["metadata"]["overlapRows"], 32)

    def test_preserves_a_known_bnc_record_in_source_usd_millions(self):
        project = next(p for p in self.data["projects"] if p["ref"] == "PRJAE0615645")
        self.assertEqual(project["name"], "Marina 101 - Marsa")
        self.assertEqual(project["valueUsd"], 700_000_000)
        self.assertEqual(project["value"], 700.0)
        self.assertEqual(project["source"], "brownfield")

    def test_excludes_contact_level_personal_information(self):
        forbidden = {"phone", "email", "keyContact", "contactName", "assignee"}
        for project in self.data["projects"]:
            self.assertTrue(forbidden.isdisjoint(project))

    def test_records_source_provenance(self):
        sources = self.data["metadata"]["sources"]
        self.assertEqual([source["rows"] for source in sources], [3327, 568, 673])
        self.assertEqual([source["key"] for source in sources], ["urban_industrial", "other_sectors", "brownfield"])

    def test_does_not_turn_workbook_placeholders_into_companies(self):
        company_fields = ("leadConsultants", "mepConsultants", "mainContractors", "mepContractors")
        names = {name.casefold() for project in self.data["projects"] for field in company_fields for name in project[field]}
        self.assertNotIn("not yet awarded", names)
        self.assertNotIn("see sub-projects", names)


if __name__ == "__main__":
    unittest.main()
