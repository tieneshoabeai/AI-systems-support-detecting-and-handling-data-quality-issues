"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaInferenceService = void 0;
const common_1 = require("@nestjs/common");
let SchemaInferenceService = class SchemaInferenceService {
    inferSchema(headers, sampleRows) {
        return this.inferSchemaWithIssues(headers, sampleRows).columns;
    }
    inferSchemaWithIssues(headers, sampleRows) {
        const columns = headers.map((header, i) => {
            const values = sampleRows
                .map((row) => row[header])
                .filter((val) => val !== undefined);
            let missingCount = 0;
            const nonNullValues = [];
            for (const val of values) {
                if (this.isNullOrEmpty(val)) {
                    missingCount++;
                }
                else {
                    nonNullValues.push(val);
                }
            }
            return {
                key: `c${i}`,
                index: i,
                name: header,
                originalName: header,
                dataType: this.detectDataType(nonNullValues),
                missingCount,
                isPii: false,
            };
        });
        return { columns, issues: this.detectColumnIssues(headers) };
    }
    detectColumnIssues(headers) {
        const issues = [];
        const seen = new Map();
        headers.forEach((h, i) => {
            const key = `c${i}`;
            if (h === '') {
                issues.push({ columnKey: key, issue: 'empty_name', message: `Cot ${key} co ten rong` });
            }
            else if (/^\s+$/.test(h)) {
                issues.push({ columnKey: key, issue: 'whitespace_only', message: `Cot ${key} chi chua khoang trang` });
            }
            const first = seen.get(h);
            if (first !== undefined && h !== '') {
                issues.push({ columnKey: key, issue: 'duplicate_name', message: `Ten cot "${h}" bi trung (cot c${first} va ${key})` });
            }
            else if (first === undefined) {
                seen.set(h, i);
            }
        });
        return issues;
    }
    isNullOrEmpty(val) {
        if (val === null || val === undefined)
            return true;
        if (typeof val === 'string') {
            const str = val.trim().toLowerCase();
            return str === '' || str === 'null' || str === 'undefined' || str === 'na' || str === 'n/a';
        }
        return false;
    }
    detectDataType(values) {
        if (values.length === 0)
            return 'string';
        let booleanCount = 0;
        let numberCount = 0;
        let dateCount = 0;
        for (const val of values) {
            if (typeof val === 'boolean') {
                booleanCount++;
            }
            else if (typeof val === 'number') {
                numberCount++;
            }
            else if (typeof val === 'string') {
                const trimmed = val.trim();
                if (this.isBooleanString(trimmed)) {
                    booleanCount++;
                }
                else if (this.isNumericString(trimmed)) {
                    numberCount++;
                }
                else if (this.isDateString(trimmed)) {
                    dateCount++;
                }
            }
        }
        const total = values.length;
        const threshold = 0.8;
        if (numberCount / total >= threshold)
            return 'number';
        if (booleanCount / total >= threshold)
            return 'boolean';
        if (dateCount / total >= threshold)
            return 'date';
        return 'string';
    }
    isBooleanString(str) {
        const lower = str.toLowerCase();
        return lower === 'true' || lower === 'false' || lower === 'yes' || lower === 'no';
    }
    isNumericString(str) {
        if (str === '')
            return false;
        const num = Number(str);
        return !isNaN(num) && isFinite(num);
    }
    isDateString(str) {
        if (!str.includes('-') && !str.includes('/'))
            return false;
        const timestamp = Date.parse(str);
        return !isNaN(timestamp);
    }
};
exports.SchemaInferenceService = SchemaInferenceService;
exports.SchemaInferenceService = SchemaInferenceService = __decorate([
    (0, common_1.Injectable)()
], SchemaInferenceService);
//# sourceMappingURL=schema-inference.service.js.map