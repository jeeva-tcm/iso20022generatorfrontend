import re

def parse_xsd_error(msg):
    if 'not expected' in msg:
        m = re.search(r"Element '(?:\{[^}]+\})?([^']+)'.*?Expected is(?: one of)? \(\s*([^)]+)\s*\)", msg)
        if m:
            found_elem = m.group(1).strip()
            expected_str = m.group(2)
            all_expected = [t.strip().strip('()').split('}')[-1] for t in expected_str.split(',')]
            if found_elem in ['Cd', 'Prtry'] and ('Cd' in all_expected or 'Prtry' in all_expected):
                return ('/OrgId/Othr Mutually exclusive elements conflict', 'desc')
            return ('expected ' + str(all_expected), 'desc')
    return ('fallback', 'desc')

print(parse_xsd_error("Element '{urn:iso:std:iso:20022:tech:xsd:pain.008.001.08}Cd': This element is not expected. Expected is one of ( {urn:iso:std:iso:20022:tech:xsd:pain.008.001.08}Cd, {urn:iso:std:iso:20022:tech:xsd:pain.008.001.08}Prtry )."))
