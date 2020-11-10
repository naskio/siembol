import { ChangeDetectionStrategy, Component, ViewChild, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TestCaseWrapper } from '@app/model/test-case';
import { Type } from '@app/model/config-model';
import { FormlyForm, FormlyFieldConfig } from '@ngx-formly/core';
import { cloneDeep } from 'lodash';
import { EditorService } from '../../../services/editor.service';
import { FormlyJsonschema } from '@app/ngx-formly/formly-json-schema.service';
import { AppConfigService } from '../../../config/app-config.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TestStoreService } from '../../../services/test-store.service';
import { MatDialog } from '@angular/material/dialog';
import { SubmitDialogComponent } from '../../submit-dialog/submit-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { AppService } from '../../../services/app.service';

@Component({
    selector: 're-test-case-editor',
    templateUrl: './test-case-editor.component.html',
    styleUrls: ['./test-case-editor.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})

export class TestCaseEditorComponent implements OnInit, OnDestroy {
    public ngUnsubscribe = new Subject();
    public editedTestCase$: Observable<TestCaseWrapper>;
    public fields: FormlyFieldConfig[] = [];
    public options: any = { autoClear: false }

    public testCaseWrapper: TestCaseWrapper;
    public testCase: any;

    private testStoreService: TestStoreService;
    private testCaseCopy: any;
    
    @ViewChild('formly', { static: true }) formly: FormlyForm;
    public form: FormGroup = new FormGroup({});

    constructor(
        private appService: AppService,
        private editorService: EditorService,
        private dialog: MatDialog,
        private cd: ChangeDetectorRef,
        private router: Router,
        private activeRoute: ActivatedRoute
    ) {
        this.editedTestCase$ = editorService.configStore.editedTestCase$;
        this.testStoreService = editorService.configStore.testService;
    }

    ngOnInit() {
        if (this.editorService.metaDataMap.testing.testCaseEnabled) {
            const subschema = new FormlyJsonschema().toFieldConfig(cloneDeep(this.editorService.testSpecificationSchema));
            const schemaConverter = new FormlyJsonschema();
            schemaConverter.testSpec = subschema;
            this.fields = [schemaConverter.toFieldConfig(cloneDeep(this.appService.testCaseSchema), this.options)];

            this.editedTestCase$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(testCaseWrapper => {
                this.testCaseWrapper = testCaseWrapper;
                this.testCase = testCaseWrapper !== null ? cloneDeep(this.testCaseWrapper.testCase) : {};
                this.testCaseCopy = cloneDeep(this.testCase);

                this.form = new FormGroup({});
                this.options.formState = {
                    mainModel: this.testCase,
                    rawObjects: {},
                }
            });
        }
    }

    ngOnDestroy() {
        this.ngUnsubscribe.next();
        this.ngUnsubscribe.complete();
    }

    onSubmitTestCase() {
        const currentTestCase = this.getTestCaseWrapper();
        this.testStoreService.updateEditedTestCase(currentTestCase);
        const dialogRef = this.dialog.open(SubmitDialogComponent, {
            data: {
                name: currentTestCase.testCase.test_case_name,
                type: Type.TESTCASE_TYPE,
                validate: () => this.editorService.configStore.testService.validateEditedTestCase(),
                submit: () => this.editorService.configStore.testService.submitEditedTestCase()
            },
            disableClose: true 
        }
        );
        dialogRef.afterClosed().subscribe(
            success => {
                if (success) {
                    this.router.navigate(
                        [],
                        {
                            relativeTo: this.activeRoute,
                            queryParams: { testCaseName: currentTestCase.testCase.test_case_name },
                            queryParamsHandling: 'merge',
                        }
                    );
                }
            }
        );
    }

    onRunTestCase() {
        this.testStoreService.updateEditedTestCase(this.getTestCaseWrapper());
        this.testStoreService.runEditedTestCase();
    }

    onUpdateTestCase(event: any) {
        this.testCaseCopy = event;
    }

    private getTestCaseWrapper(): TestCaseWrapper {
        const ret = cloneDeep(this.testCaseWrapper) as TestCaseWrapper;
        ret.testCase = cloneDeep(this.testCaseCopy);
        ret.testCase.test_specification = this.editorService.configSchema
            .cleanRawObjects(ret.testCase.test_specification, this.formly.options.formState.rawObjects);
        return ret;
    }
}
