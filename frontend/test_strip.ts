import { stripIds } from './src/utils';

const testData = {
    "name": "License",
    "type": "TAB",
    "width": 12,
    "offset": 0,
    "contents": {
        "width": 12,
        "cellWidth": 1,
        "rows": [
            {
                "contents": [
                    {
                        "name": "License Warning",
                        "type": "SECTION",
                        "width": 12,
                        "offset": 0,
                        "contents": {
                            "width": 12,
                            "cellWidth": 1,
                            "rows": [
                                {
                                    "contents": [
                                        {
                                            "name": "ETQ_SYS_PREF_LICENSE_WARNING_EMAIL_SUBJECT",
                                            "type": "FIELD",
                                            "width": 3,
                                            "offset": 0,
                                            "id": "mtvnhf2"
                                        }
                                    ]
                                }
                            ]
                        },
                        "id": "vkhw2kp"
                    }
                ]
            }
        ]
    },
    "id": "ussuvub"
};

const clean = stripIds(testData);
console.log(JSON.stringify(clean, null, 2));

if (JSON.stringify(clean).includes('"id":')) {
    console.error("FAIL: id found in output");
    process.exit(1);
} else {
    console.log("PASS: No id found");
}
